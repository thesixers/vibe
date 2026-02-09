#include "url_parser.h"
#include <cstring>

namespace vibe {

// Pre-computed hex decode table
static int HEX_TABLE[256] = {-1};
static bool hexTableInitialized = false;

static void initHexTable() {
    if (hexTableInitialized) return;
    
    for (int i = 0; i < 256; i++) HEX_TABLE[i] = -1;
    
    for (int i = '0'; i <= '9'; i++) HEX_TABLE[i] = i - '0';
    for (int i = 'a'; i <= 'f'; i++) HEX_TABLE[i] = i - 'a' + 10;
    for (int i = 'A'; i <= 'F'; i++) HEX_TABLE[i] = i - 'A' + 10;
    
    hexTableInitialized = true;
}

std::string UrlParser::DecodeURIComponent(const std::string& encoded) {
    initHexTable();
    
    std::string result;
    result.reserve(encoded.size());
    
    const char* data = encoded.data();
    size_t len = encoded.size();
    
    for (size_t i = 0; i < len; i++) {
        char c = data[i];
        
        if (c == '%' && i + 2 < len) {
            int hi = HEX_TABLE[static_cast<unsigned char>(data[i + 1])];
            int lo = HEX_TABLE[static_cast<unsigned char>(data[i + 2])];
            
            if (hi >= 0 && lo >= 0) {
                result += static_cast<char>((hi << 4) | lo);
                i += 2;
                continue;
            }
        } else if (c == '+') {
            result += ' ';
            continue;
        }
        
        result += c;
    }
    
    return result;
}

UrlParser::ParseResult UrlParser::Parse(const std::string& url) {
    ParseResult result;
    
    const char* data = url.data();
    size_t len = url.size();
    
    // Find query string start using pointer arithmetic (faster)
    const char* qmark = static_cast<const char*>(memchr(data, '?', len));
    
    if (!qmark) {
        result.pathname = url;
        return result;
    }
    
    size_t pathLen = qmark - data;
    result.pathname = std::string(data, pathLen);
    
    // Parse query string
    const char* queryStart = qmark + 1;
    size_t queryLen = len - pathLen - 1;
    
    const char* pos = queryStart;
    const char* end = queryStart + queryLen;
    
    while (pos < end) {
        // Find & or end
        const char* amp = static_cast<const char*>(memchr(pos, '&', end - pos));
        const char* pairEnd = amp ? amp : end;
        
        // Find = in pair
        size_t pairLen = pairEnd - pos;
        const char* eq = static_cast<const char*>(memchr(pos, '=', pairLen));
        
        if (eq && eq > pos) {
            std::string key = DecodeURIComponent(std::string(pos, eq - pos));
            std::string value = DecodeURIComponent(std::string(eq + 1, pairEnd - eq - 1));
            result.query[key] = value;
        }
        
        pos = pairEnd + 1;
    }
    
    return result;
}

Napi::Value ParseUrl(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    
    if (info.Length() < 1 || !info[0].IsString()) {
        Napi::TypeError::New(env, "URL string expected").ThrowAsJavaScriptException();
        return env.Null();
    }
    
    std::string url = info[0].As<Napi::String>().Utf8Value();
    UrlParser::ParseResult parsed = UrlParser::Parse(url);
    
    Napi::Object result = Napi::Object::New(env);
    result.Set("pathname", Napi::String::New(env, parsed.pathname));
    
    Napi::Object query = Napi::Object::New(env);
    for (const auto& pair : parsed.query) {
        query.Set(pair.first, Napi::String::New(env, pair.second));
    }
    result.Set("query", query);
    
    return result;
}

Napi::Value ParseQuery(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    
    if (info.Length() < 1 || !info[0].IsString()) {
        return Napi::Object::New(env);
    }
    
    initHexTable();
    
    std::string queryString = info[0].As<Napi::String>().Utf8Value();
    const char* data = queryString.data();
    size_t len = queryString.size();
    
    // Skip leading ?
    if (len > 0 && data[0] == '?') {
        data++;
        len--;
    }
    
    Napi::Object result = Napi::Object::New(env);
    
    const char* pos = data;
    const char* end = data + len;
    
    while (pos < end) {
        const char* amp = static_cast<const char*>(memchr(pos, '&', end - pos));
        const char* pairEnd = amp ? amp : end;
        size_t pairLen = pairEnd - pos;
        
        const char* eq = static_cast<const char*>(memchr(pos, '=', pairLen));
        
        if (eq && eq > pos) {
            std::string key = UrlParser::DecodeURIComponent(std::string(pos, eq - pos));
            std::string value = UrlParser::DecodeURIComponent(std::string(eq + 1, pairEnd - eq - 1));
            result.Set(key, Napi::String::New(env, value));
        }
        
        pos = pairEnd + 1;
    }
    
    return result;
}

Napi::Value DecodeURI(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    
    if (info.Length() < 1 || !info[0].IsString()) {
        return Napi::String::New(env, "");
    }
    
    std::string encoded = info[0].As<Napi::String>().Utf8Value();
    std::string decoded = UrlParser::DecodeURIComponent(encoded);
    
    return Napi::String::New(env, decoded);
}

} // namespace vibe
