import { Test, TestingModule } from '@nestjs/testing';
import { EmisService } from './emis.service';

describe('EmisService', () => {
  let service: EmisService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [EmisService],
    }).compile();

    service = module.get<EmisService>(EmisService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
