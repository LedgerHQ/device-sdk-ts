import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EtherscanService } from './EtherscanService';

// Mock axios
vi.mock('axios', () => ({
  default: {
    get: vi.fn()
  }
}));

describe('EtherscanService', () => {
  let etherscanService: EtherscanService;
  const mockApiKey = 'test-api-key';

  beforeEach(() => {
    etherscanService = new EtherscanService({
      apiKey: mockApiKey,
      timeout: 30000
    });
  });

  describe('constructor', () => {
    it('should throw error if API key is not provided', () => {
      expect(() => {
        new EtherscanService({ apiKey: '' });
      }).toThrow('Etherscan API key is required');
    });

    it('should initialize with default values', () => {
      const service = new EtherscanService({ apiKey: mockApiKey });
      expect(service).toBeInstanceOf(EtherscanService);
    });

    it('should initialize with custom values', () => {
      const service = new EtherscanService({
        apiKey: mockApiKey,
        baseUrl: 'https://custom.etherscan.io/api',
        timeout: 60000
      });
      expect(service).toBeInstanceOf(EtherscanService);
    });
  });

  describe('getContractTransactions', () => {
    it('should fetch contract transactions successfully', async () => {
      const mockResponse = {
        data: {
          status: '1',
          message: 'OK',
          result: [
            {
              hash: '0x123...',
              from: '0xabc...',
              to: '0xdef...',
              value: '1000000000000000000',
              gas: '21000',
              gasPrice: '20000000000',
              nonce: '0',
              blockNumber: '12345',
              transactionIndex: '0',
              input: '0x',
              raw: '0x02f8b4018325554c847735940085022d0b7c608307a12094dac17f958d2ee523a2206206994597c13d831ec780b844a9059cbb000000000000000000000000920ab45225b3057293e760a3c2d74643ad696a1b000000000000000000000000000000000000000000000000000000012a05f200c080a009e2ef5a2c4b7a1d7f0d868388f3949a00a1bdc5669c59b73e57b2a4e7c5e29fa0754aa9f4f1acc99561678492a20c31e01da27d648e69665f7768f96db39220ca'
            }
          ]
        }
      };

      const axios = await import('axios');
      vi.mocked(axios.default.get).mockResolvedValue(mockResponse);

      const result = await etherscanService.getContractTransactions('0x1234567890123456789012345678901234567890', 5);
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(result && result.length).toBe(1);
      expect(result && result[0] && result[0].hash).toBe('0x123...');
      expect(axios.default.get).toHaveBeenCalledWith(
        'https://api.etherscan.io/api',
        expect.objectContaining({
          params: expect.objectContaining({
            module: 'account',
            action: 'txlist',
            address: '0x1234567890123456789012345678901234567890',
            offset: 5,
            apikey: mockApiKey
          }),
          timeout: 30000
        })
      );
    });

    it('should handle API errors', async () => {
      const mockResponse = {
        data: {
          status: '0',
          message: 'Invalid API Key',
          result: []
        }
      };

      const axios = await import('axios');
      vi.mocked(axios.default.get).mockResolvedValue(mockResponse);

      await expect(
        etherscanService.getContractTransactions('0x1234567890123456789012345678901234567890')
      ).rejects.toThrow('Etherscan API error: Invalid API Key');
    });
  });

  describe('getTransactionByHash', () => {
    it('should fetch transaction by hash successfully', async () => {
      const mockResponse = {
        data: {
          status: '1',
          message: 'OK',
          result: {
            hash: '0x123...',
            from: '0xabc...',
            to: '0xdef...',
            value: '1000000000000000000',
            gas: '21000',
            gasPrice: '20000000000',
            nonce: '0',
            blockNumber: '12345',
            transactionIndex: '0',
            input: '0x',
            raw: '0x02f8b4018325554c847735940085022d0b7c608307a12094dac17f958d2ee523a2206206994597c13d831ec780b844a9059cbb000000000000000000000000920ab45225b3057293e760a3c2d74643ad696a1b000000000000000000000000000000000000000000000000000000012a05f200c080a009e2ef5a2c4b7a1d7f0d868388f3949a00a1bdc5669c59b73e57b2a4e7c5e29fa0754aa9f4f1acc99561678492a20c31e01da27d648e69665f7768f96db39220ca'
          }
        }
      };

      const axios = await import('axios');
      vi.mocked(axios.default.get).mockResolvedValue(mockResponse);

      const result = await etherscanService.getTransactionByHash('0x123...');

      expect(result.hash).toBe('0x123...');
      expect(result.from).toBe('0xabc...');
      expect(result.to).toBe('0xdef...');
      expect(axios.default.get).toHaveBeenCalledWith(
        'https://api.etherscan.io/api',
        expect.objectContaining({
          params: expect.objectContaining({
            module: 'proxy',
            action: 'eth_getTransactionByHash',
            txhash: '0x123...',
            apikey: mockApiKey
          }),
          timeout: 30000
        })
      );
    });

    it('should handle transaction not found', async () => {
      const mockResponse = {
        data: {
          status: '0',
          message: 'No transactions found',
          result: null
        }
      };

      const axios = await import('axios');
      vi.mocked(axios.default.get).mockResolvedValue(mockResponse);

      await expect(
        etherscanService.getTransactionByHash('0x123...')
      ).rejects.toThrow('Transaction not found: 0x123...');
    });
  });

  describe('isAddressContract', () => {
    it('should return true for contract addresses', async () => {
      const mockResponse = {
        data: {
          status: '1',
          message: 'OK',
          result: '0x608060405234801561001057600080fd5b50610150806100206000396000f3fe608060405234801561001057600080fd5b50600436106100365760003560e01c80632e64cec11461003b5780636057361d14610059575b600080fd5b610043610075565b60405161005091906100a1565b60405180910390f35b610073600480360381019061006e91906100ed565b61007e565b005b60008054905090565b8060008190555050565b6000819050919050565b61009b81610088565b82525050565b60006020820190506100b66000830184610092565b92915050565b600080fd5b6100ca81610088565b81146100d557600080fd5b50565b6000813590506100e7816100c1565b92915050565b600060208284031215610103576101026100bc565b5b6000610111848285016100d8565b9150509291505056fea2646970667358221220d8aa0f3076f1c1417f0dfca5c5e575fdcade600e77fe56a21096614281d4abdb64736f6c63430008120033'
        }
      };

      const axios = await import('axios');
      vi.mocked(axios.default.get).mockResolvedValue(mockResponse);

      const result = await etherscanService.isAddressContract('0x1234567890123456789012345678901234567890');

      expect(result).toBe(true);
      expect(axios.default.get).toHaveBeenCalledWith(
        'https://api.etherscan.io/api',
        expect.objectContaining({
          params: expect.objectContaining({
            module: 'proxy',
            action: 'eth_getCode',
            address: '0x1234567890123456789012345678901234567890',
            tag: 'latest',
            apikey: mockApiKey
          }),
          timeout: 30000
        })
      );
    });

    it('should return false for non-contract addresses', async () => {
      const mockResponse = {
        data: {
          status: '1',
          message: 'OK',
          result: '0x'
        }
      };

      const axios = await import('axios');
      vi.mocked(axios.default.get).mockResolvedValue(mockResponse);

      const result = await etherscanService.isAddressContract('0x1234567890123456789012345678901234567890');

      expect(result).toBe(false);
    });

    it('should handle API errors', async () => {
      const mockResponse = {
        data: {
          status: '0',
          message: 'Invalid API Key',
          result: ''
        }
      };

      const axios = await import('axios');
      vi.mocked(axios.default.get).mockResolvedValue(mockResponse);

      await expect(
        etherscanService.isAddressContract('0x1234567890123456789012345678901234567890')
      ).rejects.toThrow('Etherscan API error: Invalid API Key');
    });
  });
}); 