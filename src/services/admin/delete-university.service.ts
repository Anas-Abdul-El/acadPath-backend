import AppErr from "../../libs/appErr.js";
import * as adminRepo from "../../repositories/admin.repo.js";

/**
 * Deletes a university for DELETE /admin/universities/:universityId, with its
 * majors, courses and sources. Student profiles that pointed to it are set to
 * null, and study plans that use its courses are deleted. Refused while any
 * academic record uses one of its courses.
 */
export const deleteUniversity = async (universityId: string) => {
  const university = await adminRepo.findUniversityById(universityId);
  if (!university) throw new AppErr("University not found", 404);

  if (await adminRepo.countUniversityAcademicRecords(universityId))
    throw new AppErr(
      "Courses at this university are used in student records",
      409,
    );

  await adminRepo.deleteUniversity(universityId);
};
