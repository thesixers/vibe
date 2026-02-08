#include "json_stringify.h"
#include <cmath>
#include <cstring>
#include <vector>

namespace vibe {

// Pre-allocated escape table for fast lookup
static const char* ESCAPE_TABLE[256] = {nullptr};
static bool escapeTableInitialized = false;

static void initEscapeTable() {
    if (escapeTableInitialized) return;
    
    // Control characters
    ESCAPE_TABLE['"'] = "\\\"";
    ESCAPE_TABLE['\\'] = "\\\\";
    ESCAPE_TABLE['\b'] = "\\b";
    ESCAPE_TABLE['\f'] = "\\f";
    ESCAPE_TABLE['\n'] = "\\n";
    ESCAPE_TABLE['\r'] = "\\r";
    ESCAPE_TABLE['\t'] = "\\t";
    
    escapeTableInitialized = true;
}

// Fast string builder using pre-allocated buffer
class FastStringBuilder {
public:
    FastStringBuilder() : buffer_(4096) {
        pos_ = 0;
    }
    
    void reserve(size_t size) {
        if (buffer_.size() < size) {
            buffer_.resize(size * 2);
        }
    }
    
    void append(char c) {
        ensureCapacity(1);
        buffer_[pos_++] = c;
    }
    
    void append(const char* str, size_t len) {
        ensureCapacity(len);
        memcpy(&buffer_[pos_], str, len);
        pos_ += len;
    }
    
    void append(const char* str) {
        append(str, strlen(str));
    }
    
    void appendInt(int64_t value) {
        char buf[32];
        int len = snprintf(buf, sizeof(buf), "%ld", value);
        append(buf, len);
    }
    
    void appendDouble(double value) {
        char buf[32];
        int len = snprintf(buf, sizeof(buf), "%.15g", value);
        append(buf, len);
    }
    
    std::string toString() {
        return std::string(buffer_.data(), pos_);
    }
    
private:
    void ensureCapacity(size_t needed) {
        if (pos_ + needed > buffer_.size()) {
            buffer_.resize((pos_ + needed) * 2);
        }
    }
    
    std::vector<char> buffer_;
    size_t pos_;
};

// Fast string escape using lookup table
static void escapeStringFast(FastStringBuilder& sb, const std::string& str) {
    sb.append('"');
    
    const char* data = str.data();
    size_t len = str.size();
    size_t lastPos = 0;
    
    for (size_t i = 0; i < len; i++) {
        unsigned char c = static_cast<unsigned char>(data[i]);
        
        if (c < 0x20 || c == '"' || c == '\\') {
            // Flush unescaped segment
            if (i > lastPos) {
                sb.append(data + lastPos, i - lastPos);
            }
            
            // Handle escape
            if (ESCAPE_TABLE[c]) {
                sb.append(ESCAPE_TABLE[c]);
            } else {
                // Control character - use \u escape
                char buf[8];
                snprintf(buf, sizeof(buf), "\\u%04x", c);
                sb.append(buf, 6);
            }
            
            lastPos = i + 1;
        }
    }
    
    // Flush remaining
    if (lastPos < len) {
        sb.append(data + lastPos, len - lastPos);
    }
    
    sb.append('"');
}

static void stringifyValueFast(FastStringBuilder& sb, const Napi::Value& value, int depth);

static void stringifyArrayFast(FastStringBuilder& sb, const Napi::Array& arr, int depth) {
    if (depth > 10) {
        sb.append("null", 4);
        return;
    }
    
    sb.append('[');
    uint32_t len = arr.Length();
    
    for (uint32_t i = 0; i < len; i++) {
        if (i > 0) sb.append(',');
        stringifyValueFast(sb, arr.Get(i), depth + 1);
    }
    
    sb.append(']');
}

static void stringifyObjectFast(FastStringBuilder& sb, const Napi::Object& obj, int depth) {
    if (depth > 10) {
        sb.append("null", 4);
        return;
    }
    
    sb.append('{');
    Napi::Array keys = obj.GetPropertyNames();
    uint32_t len = keys.Length();
    bool first = true;
    
    for (uint32_t i = 0; i < len; i++) {
        Napi::Value key = keys.Get(i);
        Napi::Value val = obj.Get(key);
        
        if (val.IsUndefined()) continue;
        
        if (!first) sb.append(',');
        first = false;
        
        escapeStringFast(sb, key.As<Napi::String>().Utf8Value());
        sb.append(':');
        stringifyValueFast(sb, val, depth + 1);
    }
    
    sb.append('}');
}

static void stringifyValueFast(FastStringBuilder& sb, const Napi::Value& value, int depth) {
    if (value.IsNull() || value.IsUndefined()) {
        sb.append("null", 4);
        return;
    }
    
    if (value.IsBoolean()) {
        if (value.As<Napi::Boolean>().Value()) {
            sb.append("true", 4);
        } else {
            sb.append("false", 5);
        }
        return;
    }
    
    if (value.IsNumber()) {
        double num = value.As<Napi::Number>().DoubleValue();
        if (std::isnan(num) || std::isinf(num)) {
            sb.append("null", 4);
        } else if (num == static_cast<int64_t>(num) && num >= -9007199254740991.0 && num <= 9007199254740991.0) {
            sb.appendInt(static_cast<int64_t>(num));
        } else {
            sb.appendDouble(num);
        }
        return;
    }
    
    if (value.IsString()) {
        escapeStringFast(sb, value.As<Napi::String>().Utf8Value());
        return;
    }
    
    if (value.IsArray()) {
        stringifyArrayFast(sb, value.As<Napi::Array>(), depth);
        return;
    }
    
    if (value.IsObject()) {
        Napi::Object obj = value.As<Napi::Object>();
        
        // Check for toJSON
        if (obj.Has("toJSON") && obj.Get("toJSON").IsFunction()) {
            Napi::Function toJSON = obj.Get("toJSON").As<Napi::Function>();
            Napi::Value result = toJSON.Call(obj, {});
            stringifyValueFast(sb, result, depth);
            return;
        }
        
        stringifyObjectFast(sb, obj, depth);
        return;
    }
    
    sb.append("null", 4);
}

Napi::String JsonStringifier::Stringify(const Napi::Env& env, const Napi::Value& value) {
    initEscapeTable();
    
    FastStringBuilder sb;
    stringifyValueFast(sb, value, 0);
    return Napi::String::New(env, sb.toString());
}

Napi::Value FastStringify(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    
    if (info.Length() < 1) {
        return Napi::String::New(env, "undefined");
    }
    
    return JsonStringifier::Stringify(env, info[0]);
}

} // namespace vibe
