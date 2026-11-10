import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import type { UserSearchResultDto } from '@master-jdr/shared';
import { AuthenticatedGuard } from '../auth/guards/authenticated.guard';
import { UsersService } from './users.service';
import { SearchUsersDto } from './dto/search-users.dto';

@UseGuards(AuthenticatedGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  /** Recherche par pseudo, correspondance partielle insensible à la casse (pour inviter un joueur). */
  @Get('search')
  search(@Query() dto: SearchUsersDto): Promise<UserSearchResultDto[]> {
    return this.users.searchByPseudo(dto.q);
  }
}
