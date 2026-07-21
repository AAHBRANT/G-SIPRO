UPDATE "support_tickets"
SET "status"='TRIAGED', "approvalRequired"=false, "approvalReason"=NULL, "updatedAt"=CURRENT_TIMESTAMP
WHERE "status"='WAITING_APPROVAL' AND "resolutionAttempts" < 3;
