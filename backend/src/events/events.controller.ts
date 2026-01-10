import { Controller, Get, Post, Body, Patch, Param, Delete, Res, UseInterceptors, UploadedFile } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import * as express from 'express';
import { EventsService } from './events.service';
import { CreateEventDto, UpdateEventDto } from './dto/create-event.dto';
import { CreateCompetitionDto } from './dto/create-competition.dto';
import { RegisterParticipantDto } from './dto/register-participant.dto';
import { InputResultDto } from './dto/input-result.dto';

@Controller('events')
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}
  
  // Tally endpoint added

  @Post()
  create(@Body() createEventDto: CreateEventDto) {
    return this.eventsService.create(createEventDto);
  }

  @Get()
  findAll() {
    return this.eventsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.eventsService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateEventDto: UpdateEventDto) {
    return this.eventsService.update(id, updateEventDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.eventsService.remove(id);
  }

  @Post(':id/competitions')
  createCompetition(@Param('id') id: string, @Body() createCompetitionDto: CreateCompetitionDto) {
    return this.eventsService.createCompetition(id, createCompetitionDto);
  }

  @Get('competitions/:id')
  findCompetition(@Param('id') id: string) {
      return this.eventsService.findCompetition(id);
  }

  @Delete('competitions/:id')
  removeCompetition(@Param('id') id: string) {
      return this.eventsService.removeCompetition(id);
  }

  @Post('competitions/:id/participants')
  registerParticipant(@Param('id') id: string, @Body() dto: RegisterParticipantDto) {
    return this.eventsService.registerParticipant(id, dto);
  }

  @Delete('participants/:participantId')
  removeParticipant(@Param('participantId') participantId: string) {
    return this.eventsService.removeParticipant(participantId);
  }

  @Post('competitions/:id/results')
  inputResult(@Param('id') id: string, @Body() dto: InputResultDto) {
    return this.eventsService.inputResult(id, dto);
  }

  @Get(':id/tally')
  getMedalTally(@Param('id') id: string) {
    return this.eventsService.getMedalTally(id);
  }

  @Post('/competitions/:id/template')
  @UseInterceptors(FileInterceptor('file', {
    storage: diskStorage({
      destination: './uploads/templates',
      filename: (req, file, cb) => {
        const randomName = Array(32).fill(null).map(() => (Math.round(Math.random() * 16)).toString(16)).join('');
        return cb(null, `${randomName}${extname(file.originalname)}`);
      }
    })
  }))
  async uploadTemplate(@Param('id') id: string, @UploadedFile() file: Express.Multer.File) {
    // console.log('File uploaded:', file);
    return this.eventsService.uploadTemplate(id, file.path);
  }

  @Post('/competitions/:id/results/import')
  @UseInterceptors(FileInterceptor('file'))
  async importResults(@Param('id') id: string, @UploadedFile() file: Express.Multer.File) {
      if (!file) throw new Error('File not provided');
      return this.eventsService.importResults(id, file.buffer);
  }

  @Get('competitions/:id/certificates/:participantId')
  async downloadCertificate(@Param('id') competitionId: string, @Param('participantId') participantId: string, @Res() res: express.Response) {
    const stream = await this.eventsService.generateCertificate(competitionId, participantId);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="sertifikat-${participantId}.pdf"`,
    });
    stream.pipe(res);
  }
}
