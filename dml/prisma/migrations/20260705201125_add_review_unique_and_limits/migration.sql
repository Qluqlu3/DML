-- CreateIndex
CREATE UNIQUE INDEX "reviews_company_id_user_id_key" ON "reviews"("company_id", "user_id");
