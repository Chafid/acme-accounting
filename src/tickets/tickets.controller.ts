import { Body, ConflictException, Controller, Get, Post } from '@nestjs/common';
import { Company } from '../../db/models/Company';
import {
  Ticket,
  TicketCategory,
  TicketStatus,
  TicketType,
} from '../../db/models/Ticket';
import { User, UserRole } from '../../db/models/User';

interface newTicketDto {
  type: TicketType;
  companyId: number;
}

interface TicketDto {
  id: number;
  type: TicketType;
  companyId: number;
  assigneeId: number;
  status: TicketStatus;
  category: TicketCategory;
}

/**
 * TicketsController handles ticket creation and retrieval.
 * It assigns tickets based on type and user roles within a company.
 * AI was used to refactor the conditional logic for better readability.
 * I used if-else initially but the readability is bad, and AI suggested using switch-case.
 */
@Controller('api/v1/tickets')
export class TicketsController {
  @Get()
  async findAll() {
    return await Ticket.findAll({ include: [Company, User] });
  }

  @Post()
  async create(@Body() newTicketDto: newTicketDto) {
    const { type, companyId } = newTicketDto;
    let category: TicketCategory;
    let userRole: UserRole;
    let assignee: User;

    // use LLM suggestion here to use switch case.
    switch (type) {
      case TicketType.managementReport: {
        category = TicketCategory.accounting;
        userRole = UserRole.accountant;
        const accountants = await User.findOne({
          where: { companyId, role: userRole },
          order: [['createdAt', 'DESC']],
        });
        if (!accountants)
          throw new ConflictException(
            `Cannot find user with role ${userRole} to create a ticket`,
          );
        assignee = accountants;
        break;
      }

      case TicketType.registrationAddressChange: {
        const ticketRegAddressChange = await Ticket.findOne({
          where: {
            companyId,
            type: TicketType.registrationAddressChange,
            status: TicketStatus.open,
          },
        });

        if (ticketRegAddressChange)
          throw new ConflictException(
            `There is already an open registration address change ticket for this company`,
          );

        category = TicketCategory.corporate;
        userRole = UserRole.corporateSecretary;

        const corporateSecretaries = await User.findAll({
          where: { companyId, role: userRole },
        });

        if (corporateSecretaries.length > 1) {
          throw new ConflictException(
            `Multiple users with role ${userRole}. Cannot create a ticket`,
          );
        } else if (corporateSecretaries.length === 0) {
          const assigneeDirectors = await User.findAll({
            where: { companyId, role: UserRole.director },
          });
          if (assigneeDirectors.length > 1) {
            throw new ConflictException(
              `Multiple users with role ${UserRole.director}. Cannot create a ticket`,
            );
          } else if (assigneeDirectors.length === 0) {
            throw new ConflictException(
              `Cannot find user with role ${UserRole.director} to create a ticket`,
            );
          }
          assignee = assigneeDirectors[0];
        } else assignee = corporateSecretaries[0];
        break;
      }

      case TicketType.strikeOff: {
        category = TicketCategory.management;
        userRole = UserRole.director;
        const directors = await User.findAll({
          where: { companyId, role: userRole },
        });
        if (directors.length > 1) {
          throw new ConflictException(
            `Multiple users with role ${userRole}. Cannot create a strikeOff ticket`,
          );
        }
        assignee = directors[0];
        break;
      }
      default:
        throw new ConflictException(`Ticket type is not supported`);
    }

    const ticket = await Ticket.create({
      companyId,
      assigneeId: assignee.id,
      category,
      type,
      status: TicketStatus.open,
    });

    if (type == TicketType.strikeOff) {
      await Ticket.update(
        { status: TicketStatus.resolved },
        { where: { companyId, status: TicketStatus.open } },
      );
    }

    const ticketDto: TicketDto = {
      id: ticket.id,
      type: ticket.type,
      assigneeId: ticket.assigneeId,
      status: ticket.status,
      category: ticket.category,
      companyId: ticket.companyId,
    };

    return ticketDto;
  }
}
