function $extend(obj, ext, override, deep) {
  var key;
  if (override) {
    if (deep)
      _overrideDeepExtend(obj, ext);
    else
      for (key in ext)
        obj[key] = ext[key];
  } else {
    if (deep)
      _deepExtend(obj, ext);
    else
      for (key in ext)
        if (!(key in obj))
          obj[key] = ext[key];
  }
  return obj;
}

function _overrideDeepExtend(obj, ext) {
  for (var key in ext)
    if (Object.isObjectStrict(obj[key]) && Object.isObjectStrict(ext[key]))
      _overrideDeepExtend(obj[key], ext[key]);
    else
      obj[key] = ext[key];
}

function _deepExtend(obj, ext) {
  for (var key in ext)
    if (!(key in obj)) {
      obj[key] = ext[key];
    }
}

if (process.argv.length == 2) {
  console.log('\
Usage: node watcher.js basePath [path...] [--minify] [--pjs-watch path...] [--pjs args..]\n\n\
    basePath     Specify a folder to watch changes.\n\
    path         Specify other folders to watch changes.\n\
    --minify     Specify whether to minify CSS output.\n\
    --pjs-watch  When files inside path update, regenerate .pjs in basePath.\n\
    --pjs        All arguments following are forwarded to cpp.\n\n\
   eg. node watcher.js ./doc/ --pjs-watch inc/ --pjs -D DEBUG\n\
       Watch files in ./doc/, update ./doc/*.pjs when ./doc/inc/* change.');
  process.exit(-1);
}

var pathes = [];

process.argv.splice(0, 2);
do {
  pathes.push(process.argv.shift());
} while (process.argv.length > 0 && process.argv[0].indexOf('--') == -1);

var fs = require('fs'),
    path = require('path'),
    less = require('less'),
    jade = require('jade'),
    cprc = require('child_process');

var minify = process.argv.indexOf('--minify') > -1;

var pjsAlsoWatch = process.argv.filter(function(v, idx, arr) {
  if (idx > 1 && arr[idx - 1] == '--pjs-watch')
    return true;
  return false;
});

var pjsArgs = '-P -C -w -undef -nostdinc -imacros macro.inc'.split(' ');
var pjsArgsFrom = process.argv.indexOf('--pjs');
if (pjsArgsFrom > -1) while (++pjsArgsFrom < process.argv.length)
    pjsArgs.push(process.argv[pjsArgsFrom]);

var mtime = {};
var renders = {};

var handled = {
  less: function(file, name, ext) {
    var parser = new less.Parser({
      paths: [path.dirname(file)],
      filename: path.basename(file)
    });
    try {
      parser.parse(fs.readFileSync(file).toString(), function(e, tree) {
        if (e) {
          console.log('less error:', e);
        } else {
          try {
            fs.writeFileSync(name + '.css', tree.toCSS({
              compress: minify
            }));
          } catch(e2) {
            console.log('less error:', e2);
          }
        }
      });
    } catch(e) {
      console.log('less error:', e);
    }
    return true;
  },
  jade: function(file, name, ext) {
    try {
      renders[name] = jade.compile(fs.readFileSync(file).toString(), {
        filename: file
      });
    } catch(e) {
      console.log('jade error:', e);
      return false;
    }
    handled.json(name + '.json', name, 'json');
    return true;
  },
  json: function(file, name, ext) {
    if (!renders[name])
      return false;
    var json = {};
    if (fs.existsSync(file)) {
      try {
        json = eval('(' + fs.readFileSync(file).toString() + ')');
      } catch(e) {
        console.log('json error:', e);
        return false;
      }
    }
    var dir = path.dirname(file) + '/';
    var lang = null;
    if (json && json.__lang) {
      lang = {};
      for (var locale in json.__lang) {
        try {
          lang[locale] = eval('(' +
              fs.readFileSync(dir + json.__lang[locale]).toString() + ')');
        } catch(e) {
          console.log('lang error:', e);
        }
      }
    }
    if (json && json.__multiple) {
      for (var pageName in json.__multiple)
        renderPage(pageName, json.__multiple[pageName]);
    } else {
      renderPage(name, json);
    }
    return true;
    function renderPage(pageName, locals) {
      if (locals.__output)
        pageName = path.basename(locals.__output);
      var pageInfo = {
        FILE: file,
        BASENAME: path.basename(pageName),
        NAME: dir + pageName + '.json'
      };
      $extend(locals, pageInfo);
      if (json.__data)
        $extend(locals, json.__data, false, true);
      if (!lang) {
        renderSinglePage(pageName, locals);
      } else {
        var namePattern = json.__l18nPageName || '%pageName.%locale';
        for (var locale in lang) {
          locals.locale = locale;
          locals.lang = lang[locale];
          renderSinglePage(namePattern.replace(/%([a-z]+)/ig, function(all, name) {
            if (name == 'pageName')
              return pageName;
            if (name == 'locale')
              return locale;
            return '';
          }), locals);
        }
      }
    }
    function renderSinglePage(fileName, locals) {
      try {
        fs.writeFileSync((json.__outputRoot || dir) + fileName + '.' + (json.__outputExt || 'html'),
            renders[name](locals));
      } catch(e) {
        console.log('jade error:', e);
      }
    }
  },
  pjs: function(file, name, ext) {
    var cpp = cprc.spawn('cpp', pjsArgs.concat([file, '-o', name + '.js']), {
      cwd: process.cwd()
    });
    cpp.stderr.on('data', function(data) {
      console.log('pjs error: ', data.toString());
    });
    return true;
  }
};

function check(file, enabledSet) {
  var tmp =/^(.+)\.([a-z]+)$/.exec(file);
  if (!tmp) return; // in case that no extension at all;
  var name = tmp[1], ext = tmp[2];
  if (ext in enabledSet) {
    var stat = fs.statSync(file);
    if (handled[ext](file, name, ext))
      console.log('updated %s.', file);
    else
      console.log('failed to update %s.', file);
  }
}

pathes.forEach(function(path) {
  fs.readdirSync(path).forEach(function(file) {
    check(path + file, {
      jade: true,
      less: true,
      pjs: true
    });
  });
  fs.watch(path, function(evtype, file) {
    if (evtype == 'change' && file)
      check(path + file, handled);
  });
});

var kBasePath = pathes[0];

pjsAlsoWatch.forEach(function(path) {
  fs.watch(kBasePath + path, function(evtype, file) {
    if (evtype == 'change' && file)
      fs.readdirSync(kBasePath).forEach(function(file) {
        check(kBasePath + file, {
          pjs: true
        });
      });
  });
});
