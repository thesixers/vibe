/**
 * Vibe Native - N-API Entry Point
 * 
 * Provides high-performance C++ implementations for:
 * - JSON stringification
 * - URL parsing
 * - Query string parsing
 */

#include <napi.h>
#include "json_stringify.h"
#include "url_parser.h"

Napi::Object Init(Napi::Env env, Napi::Object exports) {
    // JSON functions
    exports.Set(
        Napi::String::New(env, "stringify"),
        Napi::Function::New(env, vibe::FastStringify)
    );
    
    // URL functions
    exports.Set(
        Napi::String::New(env, "parseUrl"),
        Napi::Function::New(env, vibe::ParseUrl)
    );
    
    exports.Set(
        Napi::String::New(env, "parseQuery"),
        Napi::Function::New(env, vibe::ParseQuery)
    );
    
    exports.Set(
        Napi::String::New(env, "decodeURI"),
        Napi::Function::New(env, vibe::DecodeURI)
    );
    
    // Version info
    exports.Set(
        Napi::String::New(env, "version"),
        Napi::String::New(env, "1.0.0")
    );
    
    return exports;
}

NODE_API_MODULE(vibe_native, Init)
