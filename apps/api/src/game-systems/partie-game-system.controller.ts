import { Controller, Get, Param, ParseUUIDPipe, StreamableFile, UseGuards } from '@nestjs/common';
import type { AuthUser } from '@desdispos/shared';
import { AuthenticatedGuard } from '../auth/guards/authenticated.guard';
import { CurrentUser } from '../common/current-user.decorator';
import { GameSystemService } from './game-system.service';

@UseGuards(AuthenticatedGuard)
@Controller('parties/:id/game-systems')
export class PartieGameSystemController {
  constructor(private readonly gameSystems: GameSystemService) {}

  @Get(':systemId/assets/:key')
  async getAsset(
    @Param('id', ParseUUIDPipe) partieId: string,
    @Param('systemId') systemId: string,
    @Param('key') key: string,
    @CurrentUser() user: AuthUser,
  ): Promise<StreamableFile> {
    const buffer = await this.gameSystems.getAssetFile(partieId, systemId, key, user.id);
    return new StreamableFile(buffer, {
      type: 'application/pdf',
      disposition: `attachment; filename="${key}.pdf"`,
    });
  }
}
