import { Module } from '@nestjs/common';
import { OrphanUploadsService } from './orphan-uploads.service';

/** Entretien des fichiers envoyés (balayage des orphelins). PrismaModule est global. */
@Module({
  providers: [OrphanUploadsService],
})
export class UploadsModule {}
