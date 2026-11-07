import AppErr from "../../libs/appErr.js";
import * as adminRepo from "../../repositories/admin.repo.js";

/**
 * Deletes a major for DELETE /admin/majors/:majorId, with its courses. Student
 * profiles that pointed to it are set to null, and study plans that use its
 * courses are deleted. Refused while any academic record uses one of its courses.
 */
export const deleteMajor = async (majorId: string) => {
  const major = await adminRepo.findMajorById(majorId);
  if (!major) throw new AppErr("Major not found", 404);

  if (await adminRepo.countMajorAcademicRecords(majorId))
    throw new AppErr("Courses in this major are used in student records", 409);

  await adminRepo.deleteMajor(majorId);
};
