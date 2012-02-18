#define CLSR_BEGIN (function(){
#define CLSR_END })();

#ifdef DEBUG
#define PROD_CLSR_BEGIN 
#define PROD_CLSR_END
#define assert(x) if (!(x)) debug('assertion failed: ' + #x)
#define debug(args...) console.log(args, ' (' + __FILE__ + ', line: ' + __LINE__ + ')')
#else
#define PROD_CLSR_BEGIN CLSR_BEGIN
#define PROD_CLSR_END CLSR_END
#define assert(args)
#define debug(args...)
#endif //DEBUG
