import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateSellerDto } from './dto/create-seller.dto';
import { UpdateSellerDto } from './dto/update-seller.dto';
import { SellersService } from './sellers.service';

@Controller('sellers')
@UseGuards(JwtAuthGuard)
export class SellersController {
  constructor(private readonly sellersService: SellersService) {}

  @Get()
  list() {
    return this.sellersService.list();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.sellersService.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateSellerDto) {
    return this.sellersService.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateSellerDto) {
    return this.sellersService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.sellersService.remove(id);
  }
}
