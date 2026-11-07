import AppErr from "../../libs/appErr.js";
import * as adminRepo from "../../repositories/admin.repo.js";

/** Deletes a course for DELETE /admin/courses/:courseId, unless an academic record or study plan uses it. */
export const deleteCourse = async (courseId: string) => {
  const course = await adminRepo.findCourseById(courseId);
  if (!course) throw new AppErr("Course not found", 404);

  if (await adminRepo.countCourseUsage(courseId))
    throw new AppErr("This course is used in student records or plans", 409);

  await adminRepo.deleteCourse(courseId);
};
