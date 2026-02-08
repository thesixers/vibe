#ifndef URL_PARSER_H
#define URL_PARSER_H

#include <napi.h>
#include <string>
#include <unordered_map>

namespace vibe {

/**
 * Fast URL parser for extracting path and query parameters
 */
class UrlParser {
public:
    struct ParseResult {
        std::string pathname;
        std::unordered_map<std::string, std::string> query;
    };
    
    static ParseResult Parse(const std::string& url);
    static std::string DecodeURIComponent(const std::string& encoded);
    
private:
    static int HexToInt(char c);
};

// N-API wrapper functions
Napi::Value ParseUrl(const Napi::CallbackInfo& info);
Napi::Value ParseQuery(const Napi::CallbackInfo& info);
Napi::Value DecodeURI(const Napi::CallbackInfo& info);

} // namespace vibe

#endif // URL_PARSER_H
