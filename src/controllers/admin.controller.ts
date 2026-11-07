import type { Request, Response } from "express";
import AppErr from "../libs/appErr.js";
import * as adminService from "../services/admin/index.js";
import type {
  AdminCourseBody,
  AdminCourseParams,
  AdminCoursesQuery,
  AdminCourseUpdateBody,
  AdminMajorBody,
  AdminMajorUpdateBody,
  AdminStatsQuery,
  AdminStudentsQuery,
  AdminUniversitiesQuery,
  AdminUniversityBody,
  AdminUniversityUpdateBody,
  MajorParams,
  StudentParams,
  UniversityParams,
} from "../schemas/admin.schema.js";
import type {
  AdminCourseOutput,
  AdminCoursesOutput,
  AdminMajorOutput,
  AdminMajorsOutput,
  AdminStatsOutput,
  AdminStudentDetailsOutput,
  AdminStudentsOutput,
  AdminUniversitiesOutput,
  AdminUniversityDetailsOutput,
  AdminUniversityOutput,
} from "../types/admin.dto.js";

export const getAdminStats = async (
  req: Request,
  res: Response<AdminStatsOutput>,
) => {
  const authUser = res.locals.user;
  if (!authUser) throw new AppErr("Missing or malformed access token", 401);

  const query: AdminStatsQuery = res.locals.query;
  const data = await adminService.getAdminStats(query);
  res.send({ data });
};

export const listUniversities = async (
  req: Request,
  res: Response<AdminUniversitiesOutput>,
) => {
  const authUser = res.locals.user;
  if (!authUser) throw new AppErr("Missing or malformed access token", 401);

  const query: AdminUniversitiesQuery = res.locals.query;
  res.send(await adminService.listUniversities(query));
};

export const createUniversity = async (
  req: Request<unknown, unknown, AdminUniversityBody>,
  res: Response<AdminUniversityOutput>,
) => {
  const authUser = res.locals.user;
  if (!authUser) throw new AppErr("Missing or malformed access token", 401);

  const data = await adminService.createUniversity(req.body);
  res.status(201).send({ data });
};

export const getUniversity = async (
  req: Request,
  res: Response<AdminUniversityDetailsOutput>,
) => {
  const authUser = res.locals.user;
  if (!authUser) throw new AppErr("Missing or malformed access token", 401);

  const { universityId }: UniversityParams = res.locals.params;
  const data = await adminService.getUniversity(universityId);
  res.send({ data });
};

export const updateUniversity = async (
  req: Request<unknown, unknown, AdminUniversityUpdateBody>,
  res: Response<AdminUniversityOutput>,
) => {
  const authUser = res.locals.user;
  if (!authUser) throw new AppErr("Missing or malformed access token", 401);

  const { universityId }: UniversityParams = res.locals.params;
  const data = await adminService.updateUniversity(universityId, req.body);
  res.send({ data });
};

export const deleteUniversity = async (req: Request, res: Response) => {
  const authUser = res.locals.user;
  if (!authUser) throw new AppErr("Missing or malformed access token", 401);

  const { universityId }: UniversityParams = res.locals.params;
  await adminService.deleteUniversity(universityId);
  res.status(204).end();
};

export const listMajors = async (
  req: Request,
  res: Response<AdminMajorsOutput>,
) => {
  const authUser = res.locals.user;
  if (!authUser) throw new AppErr("Missing or malformed access token", 401);

  const { universityId }: UniversityParams = res.locals.params;
  const data = await adminService.listMajors(universityId);
  res.send({ data });
};

export const createMajor = async (
  req: Request<unknown, unknown, AdminMajorBody>,
  res: Response<AdminMajorOutput>,
) => {
  const authUser = res.locals.user;
  if (!authUser) throw new AppErr("Missing or malformed access token", 401);

  const { universityId }: UniversityParams = res.locals.params;
  const data = await adminService.createMajor(universityId, req.body);
  res.status(201).send({ data });
};

export const updateMajor = async (
  req: Request<unknown, unknown, AdminMajorUpdateBody>,
  res: Response<AdminMajorOutput>,
) => {
  const authUser = res.locals.user;
  if (!authUser) throw new AppErr("Missing or malformed access token", 401);

  const { majorId }: MajorParams = res.locals.params;
  const data = await adminService.updateMajor(majorId, req.body);
  res.send({ data });
};

export const deleteMajor = async (req: Request, res: Response) => {
  const authUser = res.locals.user;
  if (!authUser) throw new AppErr("Missing or malformed access token", 401);

  const { majorId }: MajorParams = res.locals.params;
  await adminService.deleteMajor(majorId);
  res.status(204).end();
};

export const listAdminCourses = async (
  req: Request,
  res: Response<AdminCoursesOutput>,
) => {
  const authUser = res.locals.user;
  if (!authUser) throw new AppErr("Missing or malformed access token", 401);

  const query: AdminCoursesQuery = res.locals.query;
  res.send(await adminService.listCourses(query));
};

export const createAdminCourse = async (
  req: Request<unknown, unknown, AdminCourseBody>,
  res: Response<AdminCourseOutput>,
) => {
  const authUser = res.locals.user;
  if (!authUser) throw new AppErr("Missing or malformed access token", 401);

  const data = await adminService.createCourse(authUser.id, req.body);
  res.status(201).send({ data });
};

export const updateAdminCourse = async (
  req: Request<unknown, unknown, AdminCourseUpdateBody>,
  res: Response<AdminCourseOutput>,
) => {
  const authUser = res.locals.user;
  if (!authUser) throw new AppErr("Missing or malformed access token", 401);

  const { courseId }: AdminCourseParams = res.locals.params;
  const data = await adminService.updateCourse(authUser.id, courseId, req.body);
  res.send({ data });
};

export const deleteAdminCourse = async (req: Request, res: Response) => {
  const authUser = res.locals.user;
  if (!authUser) throw new AppErr("Missing or malformed access token", 401);

  const { courseId }: AdminCourseParams = res.locals.params;
  await adminService.deleteCourse(courseId);
  res.status(204).end();
};

export const listAdminStudents = async (
  req: Request,
  res: Response<AdminStudentsOutput>,
) => {
  const authUser = res.locals.user;
  if (!authUser) throw new AppErr("Missing or malformed access token", 401);

  const query: AdminStudentsQuery = res.locals.query;
  res.send(await adminService.listStudents(query));
};

export const getAdminStudent = async (
  req: Request,
  res: Response<AdminStudentDetailsOutput>,
) => {
  const authUser = res.locals.user;
  if (!authUser) throw new AppErr("Missing or malformed access token", 401);

  const { studentId }: StudentParams = res.locals.params;
  const data = await adminService.getStudent(studentId);
  res.send({ data });
};
