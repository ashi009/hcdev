if (process.argv.length == 2) {
  console.log('\
Usage: node watcher.js basePath [--minify] [--pjs-watch path] [...] [--pjs args..]\n\n\
    basePath     Specify a folder to watch changes.\n\
    --minify     Specify whether to minify CSS output.\n\
    --pjs-watch  When files inside path update, regenerate .pjs in basePath.\n\
    --pjs        All arguments following are forwarded to cpp.\n\n\
   eg. node watcher.js ./doc/ --pjs-watch inc/ --pjs -D DEBUG\n\
       Watch files in ./doc/, update ./doc/*.pjs when ./doc/inc/* change.');
  process.exit(-1);
}

const kBasePath = process.argv[2];

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

const handled = {
  less: function(file, name, ext) {
    var parser = new less.Parser({
      paths: [path.dirname(file)],
      filename: path.basename(file)
    });
    try {
      parser.parse(fs.readFileSync(file).toString(), function(e, tree) {
        if (e)
          console.log('less error:', e);
        else
          fs.writeFileSync(name + '.css', tree.toCSS({
            compress: minify
          }));
      });
    } catch(e) {
      console.log('less error:', e);
    }
    return true;
  },
  jade: function(file, name, ext) {
    try {
      renders[name] = jade.compile(fs.readFileSync(file).toString());
    } catch(e) {
      console.log('jade error:', e);
      return false;
    }
    handled.json(name + '.json', name, 'json');
    return true;
  },
  json: function(file, name, ext) {
    var data = {};
    if (path.existsSync(file)) {
      var json = fs.readFileSync(file).toString();
      try {
        data = JSON.parse(json);
      } catch(e) {
        console.log('json error:', e);
      }
    }
    if (!renders[name])
      return false;
    fs.writeFileSync(name + '.html', renders[name](data));
    return true;
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

fs.readdirSync(kBasePath).forEach(function(file) {
  check(kBasePath + file, {
    jade: true,
    pjs: true
  });
});

fs.watch(kBasePath, function(evtype, file) {
  if (evtype == 'change' && file)
    check(kBasePath + file, handled);
});

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
