-- AlterTable
ALTER TABLE "CourseMaterialSource" ADD COLUMN     "uploadedById" TEXT;

-- AddForeignKey
ALTER TABLE "CourseMaterialSource" ADD CONSTRAINT "CourseMaterialSource_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

