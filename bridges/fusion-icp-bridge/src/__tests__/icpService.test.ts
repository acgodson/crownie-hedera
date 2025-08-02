import { ICPService } from '../icpService';

describe('ICPService', () => {
  let service: ICPService;

  beforeEach(() => {
    service = new ICPService('test-canister-id');
  });

  test('should initialize with canister ID', () => {
    expect(service).toBeDefined();
  });

  test('should return false for authentication when not authenticated', async () => {
    const isAuth = await service.isAuthenticated();
    expect(isAuth).toBe(false);
  });

  test('should return null for principal when not authenticated', () => {
    const principal = service.getPrincipal();
    expect(principal).toBeNull();
  });
});