import { StudentDocumentType } from "../generated/prisma/client.js";
import { prisma } from "../libs/prisma.js";

export const getUserInfo = async (id: string) => {
  return prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      studentProfile: {
        select: {
          yearOfStudy: true,
          onboardingCompletedAt: true,
          university: {
            select: {
              id: true,
              name: true,
              shortName: true,
              country: true,
              city: true,
              website: true,
              catalogYear: true,
              sources: {
                select: {
                  errorMessage: true,
                  lastProcessedAt: true,
                  lastFetchedAt: true,
                },
              },
            },
          },
          major: {
            select: {
              id: true,
              universityId: true,
              name: true,
              degreeType: true,
              totalRequiredCredits: true,
            },
          },
          _count: {
            select: {
              documents: { where: { type: StudentDocumentType.TRANSCRIPT } },
            },
          },
        },
      },
    },
  });
};
