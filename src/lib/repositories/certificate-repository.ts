import { type Db, type ObjectId } from "mongodb";
import { certificatesCollection } from "@/lib/db/collections";

export async function countIssuedCertificates(
  db: Db,
  tenantId: string,
  userId: ObjectId
): Promise<number> {
  return certificatesCollection(db).countDocuments({
    tenantId,
    userId,
    status: "issued",
  });
}
