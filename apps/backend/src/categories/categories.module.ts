import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module.js';
import { CategoryRepository } from './category.repository.js';

@Module({
  imports: [DatabaseModule],
  providers: [CategoryRepository],
  exports: [CategoryRepository],
})
export class CategoriesModule {}
