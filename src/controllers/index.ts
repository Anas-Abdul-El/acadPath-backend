import * as adminController from "./admin.controller.js";
import * as appController from "./app.controller.js";
import * as authController from "./auth.controller.js";
import * as meController from "./me.controller.js";

export default {
  ...adminController,
  ...appController,
  ...authController,
  ...meController,
};
