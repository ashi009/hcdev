#define CLSR_BEGIN (function(exports) {
#define CLSR_END })(this);

#define CTX_INFO [__FILE__, __LINE__]

#ifdef DEBUG

#define PROD_CLSR_BEGIN
#define PROD_CLSR_END
#define assert(x, args...) console.assert(x, #x, [args], CTX_INFO)
#define debug(args...) console.debug(args, CTX_INFO)

#else

#define PROD_CLSR_BEGIN CLSR_BEGIN
#define PROD_CLSR_END CLSR_END
#define assert(args)
#define debug(args...)

#endif //DEBUG
