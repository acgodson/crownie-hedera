import { FusionService } from '../fusionService';

describe('FusionService', () => {
  let service: FusionService;

  beforeEach(() => {
    service = new FusionService('test-api-key');
  });

  test('should initialize with API key', () => {
    expect(service).toBeDefined();
  });

  test('should generate unique order IDs', () => {
    const service1 = new FusionService('test-key-1');
    const service2 = new FusionService('test-key-2');
    
    // Access private method via type assertion for testing
    const orderId1 = (service1 as any).generateOrderId();
    const orderId2 = (service2 as any).generateOrderId();
    
    expect(orderId1).not.toBe(orderId2);
    expect(orderId1).toMatch(/^order_\d+_[a-z0-9]+$/);
  });

  test('should generate 64-character hex secrets', () => {
    const secret = (service as any).generateSecret();
    expect(secret).toHaveLength(64);
    expect(secret).toMatch(/^[0-9a-f]+$/);
  });
});