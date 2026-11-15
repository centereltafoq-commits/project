import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

export interface FirewallConfigResult {
  success: boolean;
  message: string;
}

const RULE_SPECS = [
  { name: 'EduCenter ERP Server TCP 4000', protocol: 'TCP', port: '4000' },
  { name: 'EduCenter ERP LAN Discovery UDP 41234', protocol: 'UDP', port: '41234' },
] as const;

/**
 * Adds inbound Windows Defender Firewall rules so client PCs on the local LAN
 * can reach port 4000 and auto-discover the server on UDP 41234.
 */
export async function configureLanFirewallRules(
  execFileFn: typeof execFileAsync = execFileAsync,
): Promise<FirewallConfigResult> {
  if (process.platform !== 'win32') {
    return {
      success: true,
      message: 'لا يتطلب نظام التشغيل الحالي إعدادات جدار حماية ويندوز.',
    };
  }

  try {
    for (const rule of RULE_SPECS) {
      try {
        await execFileFn(
          'netsh',
          ['advfirewall', 'firewall', 'delete', 'rule', `name=${rule.name}`],
          { windowsHide: true },
        );
      } catch {
        // Rule did not exist yet
      }

      await execFileFn(
        'netsh',
        [
          'advfirewall',
          'firewall',
          'add',
          'rule',
          `name=${rule.name}`,
          'dir=in',
          'action=allow',
          `protocol=${rule.protocol}`,
          `localport=${rule.port}`,
        ],
        { windowsHide: true },
      );
    }

    return {
      success: true,
      message: 'تم فتح منافذ الشبكة المحلية (4000 / 41234) في جدار الحماية بنجاح.',
    };
  } catch {
    return {
      success: false,
      message:
        'تحتاج تعديلات جدار الحماية لصلاحية مسؤول (Run as Administrator) أو السماح من نافذة ويندوز عند طلب الاتصال.',
    };
  }
}
