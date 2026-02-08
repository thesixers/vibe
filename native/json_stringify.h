#ifndef JSON_STRINGIFY_H
#define JSON_STRINGIFY_H

#include <napi.h>
#include <string>
#include <sstream>

namespace vibe {

/**
 * Fast JSON stringifier for common cases
 * Handles: strings, numbers, booleans, null, simple objects, arrays
 */
class JsonStringifier {
public:
    static Napi::String Stringify(const Napi::Env& env, const Napi::Value& value);
    
private:
    static void StringifyValue(std::ostringstream& ss, const Napi::Value& value, int depth);
    static void StringifyObject(std::ostringstream& ss, const Napi::Object& obj, int depth);
    static void StringifyArray(std::ostringstream& ss, const Napi::Array& arr, int depth);
    static void EscapeString(std::ostringstream& ss, const std::string& str);
    
    static constexpr int MAX_DEPTH = 10;
};

// N-API wrapper function
Napi::Value FastStringify(const Napi::CallbackInfo& info);

} // namespace vibe

#endif // JSON_STRINGIFY_H
