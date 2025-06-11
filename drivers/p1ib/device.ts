import Homey from 'homey';
import { P1ibConnector, MeterReading } from './p1ib.js';

interface DeviceSettings {
  p1ib_address?: string;
};

interface DiscoveryResult {
  id: string;
  lastSeen: Date;
  address?: string;
  port?: number;
  host?: string;
  txt?: {
    version?: string;
  };
};

const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) return error.message;
  return String(error);
};

class P1ibDevice extends Homey.Device {
  private p1ibConnector!: P1ibConnector;
  private pollTimeout!: NodeJS.Timeout;

  override async onInit(): Promise<void> {
    this.log('p1ib has been initialized');

    const settings = this.getSettings() as DeviceSettings;
    this.log('p1ib address:', settings.p1ib_address);

    this.p1ibConnector = new P1ibConnector(settings.p1ib_address ?? 'p1ib.local');
    await this.update();

    this.pollTimeout = this.homey.setInterval(async () => {
      await this.update();
    }, 10000);
  }

  private async update(): Promise<void> {
    try {
      if (!this.p1ibConnector.address) {
        this.log('No address has been set - skipping update');
        return;
      }

      const meterData: MeterReading = await this.p1ibConnector.readMeterData();
      this.log(meterData);

      const power = meterData.momentaryPowerImport - meterData.momentaryPowerExport;

      await Promise.all([
        this.setCapabilityValue('measure_signal_strength', meterData.rssi),
        this.setCapabilityValue('measure_power', power),
        this.setCapabilityValue('measure_power.export', meterData.momentaryPowerExport),
        this.setCapabilityValue('measure_power.import', meterData.momentaryPowerImport),
        this.setCapabilityValue('meter_power.imported', meterData.activeEnergyImport),
        this.setCapabilityValue('meter_power.exported', meterData.activeEnergyExport),
        this.setCapabilityValue('measure_current', meterData.currentL1 + meterData.currentL2 + meterData.currentL3),
        this.setCapabilityValue('measure_current.l1', meterData.currentL1),
        this.setCapabilityValue('measure_current.l2', meterData.currentL2),
        this.setCapabilityValue('measure_current.l3', meterData.currentL3),
        this.setCapabilityValue('measure_voltage.l1', meterData.voltageL1),
        this.setCapabilityValue('measure_voltage.l2', meterData.voltageL2),
        this.setCapabilityValue('measure_voltage.l3', meterData.voltageL3),
        this.setCapabilityValue('measure_power', meterData.powerL1 + meterData.powerL2 + meterData.powerL3),
        this.setCapabilityValue('measure_power.l1', meterData.powerL1),
        this.setCapabilityValue('measure_power.l2', meterData.powerL2),
        this.setCapabilityValue('measure_power.l3', meterData.powerL3),
        this.setAvailable(),
      ]).catch(this.error);
    } catch (error) {
      this.error('error:', error);
      await this.setUnavailable().catch(this.error);
    }
  };

  override async onAdded(): Promise<void> {
    this.log('p1ib has been added');
  };

  override async onSettings({
      newSettings,
      changedKeys,
    }: {
      newSettings: DeviceSettings;
      changedKeys: string[];
    }): Promise<string | void> {

      this.log('p1ib settings were changed');
      this.p1ibConnector.address = newSettings.p1ib_address ?? 'p1ib.local';
  };

  override async onRenamed(name: string): Promise<void> {
    this.log('p1ib was renamed');
  };

  override async onDeleted(): Promise<void> {
    this.log('p1ib has been deleted');
    this.homey.clearInterval(this.pollTimeout);
  };

  override onDiscoveryResult(discoveryResult: DiscoveryResult): boolean {
    const isMatch = discoveryResult.id === this.getData().id;
    this.log(`Discovery result match: ${isMatch}`);
    return isMatch;    
  };

  override async onDiscoveryAvailable(discoveryResult: DiscoveryResult): Promise<void> {
    this.log('onDiscoveryAvailable:', discoveryResult);

    try {
      const settings = this.getSettings() as DeviceSettings;
      const p1ibAddress = `${discoveryResult.address}:${discoveryResult.port}`;
      await this.updateSettings(settings, p1ibAddress);
      this.p1ibConnector.address = p1ibAddress;   
    } catch (error) {
      this.error('Failed to handle discovery:', getErrorMessage(error));
    }
  };

  override async onDiscoveryAddressChanged(discoveryResult: DiscoveryResult): Promise<void> {
    this.log('onDiscoveryAddressChanged', discoveryResult);
    
    try {
      const settings = this.getSettings() as DeviceSettings;
      const p1ibAddress = `${discoveryResult.address}:${discoveryResult.port}`;
      await this.updateSettings(settings, p1ibAddress);
      this.p1ibConnector.address = p1ibAddress;   
    } catch (error) {
      this.error('Failed to handle discovery:', getErrorMessage(error));
    }
  };

  override onDiscoveryLastSeenChanged(discoveryResult: DiscoveryResult): void {
    this.log('onDiscoveryLastSeenChanged', discoveryResult);
  };

  private async updateSettings(settings: DeviceSettings, p1ibAddress: string): Promise<void> {
    if (settings.p1ib_address !== p1ibAddress) {
      settings.p1ib_address = p1ibAddress;
      await this.setSettings(settings);
    };
  };

};

export default P1ibDevice;
