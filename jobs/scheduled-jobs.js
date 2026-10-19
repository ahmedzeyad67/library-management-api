import cron from "node-cron";
import scheduledJobsService from "../services/scheduled-jobs-service.js";

const startScheduledJobs = () => {
  cron.schedule("* * * * *", async () => {
    try {
      const expiredCount = await scheduledJobsService.expireReservations();

      if (expiredCount > 0) {
        console.log(`Expired reservations: ${expiredCount}`);
      }
    } catch (error) {
      console.error("Reservation expiration job failed:", error);
    }
  });

  cron.schedule("* * * * *", async () => {
    try {
      const overdueCount = await scheduledJobsService.markOverdueLoans();

      if (overdueCount > 0) {
        console.log(`Marked overdue loans: ${overdueCount}`);
      }
    } catch (error) {
      console.error("Overdue loan marking job failed:", error);
    }
  });

  console.log("Scheduled jobs started");
};

export default startScheduledJobs;
