import { Injectable } from '@nestjs/common';
import { LeadsService } from '../leads/leads.service';

@Injectable()
export class DashboardService {
  constructor(private readonly leadsService: LeadsService) {}

  overview() {
    return this.leadsService.dashboardOverview();
  }
}
