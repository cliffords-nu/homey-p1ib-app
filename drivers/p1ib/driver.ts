import Homey from 'homey';
import { P1ibConnector } from './p1ib.js';

// -----------------------------
// Types
// -----------------------------

interface DiscoveryTXTRecord {
  id: string;
  name: string;
  [key: string]: any;
}

interface DiscoveryResult {
  address: string;
  port: number;
  txt: DiscoveryTXTRecord;
}

interface P1ibDevice {
  name: string;
  data: {
    id: string;
  };
  settings: {
    p1ib_address: string;
  };
}

// -----------------------------
// Type Guard
// -----------------------------

function isP1ibDiscoveryResult(obj: unknown): obj is DiscoveryResult {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    typeof (obj as any).address === 'string' &&
    typeof (obj as any).port === 'number' &&
    typeof (obj as any).txt === 'object' &&
    typeof (obj as any).txt.id === 'string' &&
    typeof (obj as any).txt.name === 'string'
  );
}

// -----------------------------
// Driver Class
// -----------------------------

class P1ibDriver extends Homey.Driver {
  private discoveryResult?: P1ibDevice;

  async onInit(): Promise<void> {
    this.log(' P1ib driver initialized');

    const discoveryStrategy = this.getDiscoveryStrategy();
    this.log('Using discovery strategy:', discoveryStrategy ?? 'unknown');

    const initialDiscoveryResults = discoveryStrategy.getDiscoveryResults();

    for (const result of Object.values(initialDiscoveryResults)) {
      if (isP1ibDiscoveryResult(result)) {
        this.handleDiscoveryResult(result);
      } else {
        this.log(' Ignored incompatible discovery result:', result);
      }
    }

    discoveryStrategy.on('result', (result: unknown) => {
      if (isP1ibDiscoveryResult(result)) {
        this.log(' Got valid discovery result:', result);
        this.handleDiscoveryResult(result);
      } else {
        this.log(' Invalid discovery result skipped:', result);
      }
    });
  }

  private handleDiscoveryResult(discoveryResult: DiscoveryResult): void {
    const device: P1ibDevice = {
      name: discoveryResult.txt.name,
      data: {
        id: discoveryResult.txt.id,
      },
      settings: {
        p1ib_address: `${discoveryResult.address}:${discoveryResult.port}`,
      },
    };

    this.discoveryResult = device;
    this.log(' Stored discovery result:', device);
  }

  async onPair(session: {
    setHandler: (name: string, handler: (...args: any[]) => any) => void;
    showView: (viewId: string) => Promise<void>;
  }): Promise<void> {
    this.log(' onPair started');

    session.setHandler('showView', async (viewId: string) => {
      this.log(' showView:', viewId);
    });

    session.setHandler('test_connection', async (data: { p1ibAddress: string }) => {
      this.log(' test_connection:', data.p1ibAddress);

      try {
        const p1ibConnector = new P1ibConnector(data.p1ibAddress);
        const deviceInfo = await p1ibConnector.getDeviceInfo();
        this.log('✅ test_connection success:', deviceInfo);
        return deviceInfo;
      } catch (error) {
        this.error('❌ test_connection failed:', error);
        return 'ERROR';
      }
    });

    session.setHandler('list_devices', async () => {
      this.log(' list_devices called');

      if (this.discoveryResult) {
        this.log('✅ Returning discovered device:', this.discoveryResult);
        return [this.discoveryResult];
      }

      this.log('️ No devices found — switching to manual view');
      await session.showView('manual_add_view');
      return [];
    });
  }
};

export default P1ibDriver;
