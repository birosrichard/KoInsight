package.path = "plugins/koinsight.koplugin/?.lua;" .. package.path

local api_results = {}
local api_calls = 0
local progress

package.preload.gettext = function() return function(text) return text end end
package.preload.call_api = function()
  return function()
    api_calls = api_calls + 1
    return table.unpack(api_results[api_calls])
  end
end
package.preload["ui/widget/infomessage"] = function() return { new = function(_, value) return value end } end
package.preload.json = function() return { encode = function() return "{}" end } end
package.preload.db_reader = function()
  return { progressData = function() return {} end, bookData = function() return {} end }
end
package.preload.annotation_reader = function()
  return {
    getAnnotationsByBook = function() return {} end,
    getAllBooksWithAnnotations = function() return {} end,
  }
end
package.preload.logger = function()
  return { info = function() end, err = function() end, dbg = function() end }
end
package.preload["ui/uimanager"] = function()
  return { show = function() end, nextTick = function(callback) callback() end }
end
package.preload["./const"] = function() return { VERSION = "0.3.0" } end
package.preload.device = function() return { model = "Kobo" } end

G_reader_settings = { readSetting = function() return "test-device" end }

local upload = require("upload")
local function sync(results)
  api_results, api_calls, progress = results, 0, nil
  local ok = upload.syncAllBooks("http://example.test", function(value) progress = value end)
  return ok
end

assert(sync({ { false, "network_error" } }) == false)
assert(api_calls == 1)
assert(progress.phase == "error" and progress.message == "Unable to reach server.")

assert(sync({ { true, {} }, { true, {} } }) == true)
assert(api_calls == 2)
assert(progress.phase == "complete" and progress.total == 0)

print("upload sync flow: ok")
