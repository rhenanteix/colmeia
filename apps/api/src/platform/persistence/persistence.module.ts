import { Global, Module } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { Db } from './db';
@Global()
@Module({
  providers: [Db, { provide: PrismaClient, useExisting: Db }],
  exports: [Db, PrismaClient],
})
export class PersistenceModule {}
