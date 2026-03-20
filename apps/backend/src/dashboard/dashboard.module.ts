import { Module } from '@nestjs/common';
import { LeadsModule } from '../leads/leads.module';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

@Module({
  imports: [LeadsModule],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
