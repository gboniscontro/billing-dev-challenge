import { BadRequestException } from '@nestjs/common';
import { CognitoMockService } from './cognito-mock.service';

describe('CognitoMockService', () => {
  it('genera un token para credenciales validas', async () => {
    const jwtService = {
      sign: jest.fn().mockReturnValue('token-simulado'),
    } as any;
    const service = new CognitoMockService(jwtService, {} as any);

    await expect(service.login('test', 'test')).resolves.toEqual({
      accessToken: 'token-simulado',
    });
    expect(jwtService.sign).toHaveBeenCalledWith({
      sub: 'test',
      username: 'test',
      email: 'test@example.com',
      'cognito:groups': ['USER'],
    });
  });

  it('rechaza credenciales incompletas', async () => {
    const service = new CognitoMockService({ sign: jest.fn() } as any, {} as any);

    await expect(service.login('', 'test')).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.login('test', '')).rejects.toBeInstanceOf(BadRequestException);
  });
});
