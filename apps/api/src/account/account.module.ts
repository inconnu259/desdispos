import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PartiesModule } from '../parties/parties.module';
import { PermissionsModule } from '../permissions/permissions.module';
import { AccountController } from './account.controller';
import { AccountService } from './account.service';

@Module({
  imports: [AuthModule, PartiesModule, PermissionsModule],
  controllers: [AccountController],
  providers: [AccountService],
})
export class AccountModule {}
