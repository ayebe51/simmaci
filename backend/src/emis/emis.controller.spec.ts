import { Test, TestingModule } from '@nestjs/testing';
import { EmisController } from './emis.controller';

describe('EmisController', () => {
  let controller: EmisController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [EmisController],
    }).compile();

    controller = module.get<EmisController>(EmisController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
