import * as authController from "./auth.controller.js";
import * as meController from "./me.controller.js";

export default {
  ...authController,
  ...meController,
};
