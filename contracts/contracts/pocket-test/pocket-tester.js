/**
 * VisionMe - Pocket Contract CLI Tester
 * 
 * INSTALACIÓN:
 *   npm install @stellar/stellar-sdk
 * 
 * EJECUCIÓN:
 *   POCKET_CONTRACT_ID=CXXX node pocket-tester.js
 */

const {
  Keypair,
  Networks,
  Contract,
  TransactionBuilder,
  Address,
  nativeToScVal,
  xdr,
  Account
} = require('@stellar/stellar-sdk');
const { Server, Api, assembleTransaction } = require('@stellar/stellar-sdk/rpc');
const readline = require('readline');

// CONFIGURACIÓN
const CONFIG = {
  RPC_URL: 'https://soroban-testnet.stellar.org',
  NETWORK_PASSPHRASE: Networks.TESTNET,
  FRIENDBOT_URL: 'https://friendbot.stellar.org',
  POCKET_CONTRACT_ID: process.env.POCKET_CONTRACT_ID || 'TU_CONTRACT_ID_AQUI',
};

// COLORES PARA TERMINAL
const c = {
  reset: '\x1b[0m', green: '\x1b[32m', yellow: '\x1b[33m',
  blue: '\x1b[34m', red: '\x1b[31m', cyan: '\x1b[36m', bright: '\x1b[1m'
};

const log = {
  info: (msg) => console.log(`\n${c.blue}📘 [INFO]${c.reset} ${msg}`),
  success: (msg) => console.log(`\n${c.green}✅ [OK]${c.reset} ${msg}`),
  error: (msg, e) => { console.log(`\n${c.red}❌ [ERROR]${c.reset} ${msg}`); if(e) console.log(e.message || e); },
  warn: (msg) => console.log(`\n${c.yellow}⚠️ [WARN]${c.reset} ${msg}`),
  step: (n, msg) => console.log(`  ${c.cyan}[${n}]${c.reset} ${msg}`),
  header: (t) => console.log(`\n${c.bright}${'═'.repeat(50)}\n  🚀 ${t}\n${'═'.repeat(50)}${c.reset}`),
  val: (k, v) => console.log(`  ${c.cyan}${k}:${c.reset} ${v}`),
};

// CLASE PRINCIPAL
class PocketTester {
  constructor() {
    this.server = new Server(CONFIG.RPC_URL);
    this.keypair = null;
    this.contractId = CONFIG.POCKET_CONTRACT_ID;
    log.info('Tester inicializado');
    log.val('RPC', CONFIG.RPC_URL);
    log.val('Contract', this.contractId);
  }

  // GENERAR CUENTA DE PRUEBA
  async generateAccount() {
    log.header('GENERAR CUENTA');
    try {
      log.step(1, 'Creando keypair...');
      this.keypair = Keypair.random();
      const pub = this.keypair.publicKey();
      const sec = this.keypair.secret();
      log.val('Public Key', pub);
      log.val('Secret', `${sec.slice(0,8)}...${sec.slice(-8)}`);

      log.step(2, 'Fondeando con Friendbot...');
      const res = await fetch(`${CONFIG.FRIENDBOT_URL}?addr=${pub}`);
      if (!res.ok) throw new Error(`Friendbot: ${res.status}`);
      
      log.step(3, 'Verificando...');
      const acc = await this.server.getAccount(pub);
      log.success(`Cuenta lista! Seq: ${acc.sequenceNumber()}`);
      return { success: true, publicKey: pub, secret: sec };
    } catch (e) {
      log.error('Error generando cuenta', e);
      return { success: false };
    }
  }

  // CARGAR CUENTA EXISTENTE
  async loadAccount(secret) {
    log.header('CARGAR CUENTA');
    try {
      this.keypair = Keypair.fromSecret(secret);
      const pub = this.keypair.publicKey();
      log.val('Public Key', pub);
      const acc = await this.server.getAccount(pub);
      log.success(`Cuenta cargada! Seq: ${acc.sequenceNumber()}`);
      return { success: true };
    } catch (e) {
      log.error('Error cargando cuenta', e);
      return { success: false };
    }
  }

  // CREAR POCKET
  async createPocket(goal, asset, owner = null) {
    log.header('CREAR POCKET');
    if (!this.keypair) { log.error('Sin cuenta. Usa generate/load primero'); return { success: false }; }

    try {
      const ownerAddr = owner || this.keypair.publicKey();
      log.step(1, 'Preparando...');
      log.val('Asset', asset);
      log.val('Owner', ownerAddr);
      log.val('Goal', `${goal} stroops`);

      const account = await this.server.getAccount(this.keypair.publicKey());
      const contract = new Contract(this.contractId);

      // create_pocket(asset, owner, goal_amount)
      const op = contract.call(
        'create_pocket',
        Address.fromString(asset).toScVal(),
        Address.fromString(ownerAddr).toScVal(),
        nativeToScVal(BigInt(goal), { type: 'i128' })
      );

      const tx = new TransactionBuilder(account, {
        fee: '100000',
        networkPassphrase: CONFIG.NETWORK_PASSPHRASE,
      }).addOperation(op).setTimeout(30).build();

      log.step(2, 'Simulando...');
      const sim = await this.server.simulateTransaction(tx);
      if (Api.isSimulationError(sim)) throw new Error(JSON.stringify(sim.error));
      log.val('Fee', sim.minResourceFee);

      log.step(3, 'Enviando...');
      const prepared = assembleTransaction(tx, sim);
      prepared.sign(this.keypair);
      const send = await this.server.sendTransaction(prepared);
      log.val('Hash', send.hash);

      if (send.status === 'PENDING') {
        const result = await this.waitTx(send.hash);
        if (result.success) log.success('¡Pocket creado!');
        return result;
      }
      return { success: send.status !== 'ERROR', hash: send.hash };
    } catch (e) {
      log.error('Error creando pocket', e);
      return { success: false };
    }
  }

  // DEPOSITAR
  async deposit(pocketId, amount) {
    log.header('DEPOSITAR');
    if (!this.keypair) { log.error('Sin cuenta'); return { success: false }; }

    try {
      const from = this.keypair.publicKey();
      log.step(1, 'Preparando...');
      log.val('Pocket ID', pocketId);
      log.val('Amount', `${amount} stroops`);

      const account = await this.server.getAccount(from);
      const contract = new Contract(this.contractId);

      const op = contract.call(
        'deposit',
        nativeToScVal(Number(pocketId), { type: 'u32' }),
        nativeToScVal(BigInt(amount), { type: 'i128' })
      );

      const tx = new TransactionBuilder(account, {
        fee: '100000',
        networkPassphrase: CONFIG.NETWORK_PASSPHRASE,
      }).addOperation(op).setTimeout(30).build();

      log.step(2, 'Simulando...');
      const sim = await this.server.simulateTransaction(tx);
      if (Api.isSimulationError(sim)) throw new Error(JSON.stringify(sim.error));

      log.step(3, 'Enviando...');
      const prepared = assembleTransaction(tx, sim);
      prepared.sign(this.keypair);
      const send = await this.server.sendTransaction(prepared);
      log.val('Hash', send.hash);

      if (send.status === 'PENDING') {
        const result = await this.waitTx(send.hash);
        if (result.success) log.success('¡Depósito completado!');
        return result;
      }
      return { success: send.status !== 'ERROR' };
    } catch (e) {
      log.error('Error en depósito', e);
      return { success: false };
    }
  }

  // RETIRAR
  async withdraw(pocketId, amount) {
    log.header('RETIRAR');
    if (!this.keypair) { log.error('Sin cuenta'); return { success: false }; }

    try {
      const to = this.keypair.publicKey();
      log.step(1, 'Preparando...');
      log.val('Pocket ID', pocketId);
      log.val('Amount', `${amount} stroops`);

      const account = await this.server.getAccount(to);
      const contract = new Contract(this.contractId);

      const op = contract.call(
        'withdraw',
        nativeToScVal(Number(pocketId), { type: 'u32' }),
        nativeToScVal(BigInt(amount), { type: 'i128' })
      );

      const tx = new TransactionBuilder(account, {
        fee: '100000',
        networkPassphrase: CONFIG.NETWORK_PASSPHRASE,
      }).addOperation(op).setTimeout(30).build();

      log.step(2, 'Simulando...');
      const sim = await this.server.simulateTransaction(tx);
      if (Api.isSimulationError(sim)) throw new Error(JSON.stringify(sim.error));

      log.step(3, 'Enviando...');
      const prepared = assembleTransaction(tx, sim);
      prepared.sign(this.keypair);
      const send = await this.server.sendTransaction(prepared);

      if (send.status === 'PENDING') {
        const result = await this.waitTx(send.hash);
        if (result.success) log.success('¡Retiro completado!');
        return result;
      }
      return { success: send.status !== 'ERROR' };
    } catch (e) {
      log.error('Error en retiro', e);
      return { success: false };
    }
  }

  // CONSULTAR POCKET
  async getPocket(pocketId) {
    log.header('CONSULTAR POCKET');
    try {
      log.step(1, `Buscando pocket ${pocketId}...`);
      
      const contract = new Contract(this.contractId);
      const tempKp = Keypair.random();
      const tempAcc = new Account(tempKp.publicKey(), '0');

      const op = contract.call('get_pocket', nativeToScVal(Number(pocketId), { type: 'u32' }));

      const tx = new TransactionBuilder(tempAcc, {
        fee: '100000',
        networkPassphrase: CONFIG.NETWORK_PASSPHRASE,
      }).addOperation(op).setTimeout(30).build();

      const sim = await this.server.simulateTransaction(tx);
      if (Api.isSimulationError(sim)) throw new Error(JSON.stringify(sim.error));

      if (sim.result) {
        log.success('Pocket encontrado:');
        console.log('\n  📦 Datos:');
        console.log('  ', JSON.stringify(sim.result, null, 2).replace(/\n/g, '\n  '));
        return { success: true, data: sim.result };
      }
      log.warn('Sin datos');
      return { success: false };
    } catch (e) {
      log.error('Error consultando', e);
      return { success: false };
    }
  }

  // VERIFICAR SALUD
  async health() {
    log.header('VERIFICAR SISTEMA');
    try {
      log.step(1, 'Chequeando RPC...');
      const h = await this.server.getHealth();
      log.success(`RPC OK - Status: ${h.status}`);

      log.step(2, 'Verificando contrato...');
      const ledgerKey = xdr.LedgerKey.contractData(
        new xdr.LedgerKeyContractData({
          contract: Address.fromString(this.contractId).toScAddress(),
          key: xdr.ScVal.scvLedgerKeyContractInstance(),
          durability: xdr.ContractDataDurability.persistent(),
        })
      );
      const entries = await this.server.getLedgerEntries(ledgerKey);
      if (entries.entries?.length > 0) {
        log.success('¡Contrato activo!');
        return { success: true };
      }
      log.warn('Contrato no encontrado');
      return { success: false };
    } catch (e) {
      log.error('Error', e);
      return { success: false };
    }
  }

  // ESPERAR TRANSACCIÓN
  async waitTx(hash, timeout = 60000) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      try {
        const r = await this.server.getTransaction(hash);
        if (r.status === 'SUCCESS') { log.success(`TX confirmada`); return { success: true, hash }; }
        if (r.status === 'FAILED') { log.error('TX fallida'); return { success: false, hash }; }
        process.stdout.write('.');
        await new Promise(r => setTimeout(r, 2000));
      } catch { await new Promise(r => setTimeout(r, 2000)); }
    }
    return { success: false, error: 'timeout' };
  }

  setContract(id) { this.contractId = id; log.success(`Contract: ${id}`); }
}

// CLI INTERACTIVO
async function runCLI() {
  const t = new PocketTester();
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const ask = (q) => new Promise(r => rl.question(q, r));

  console.log(`
${c.bright}${c.cyan}
╔════════════════════════════════════════════════════╗
║     🌟 VisionMe - Pocket Contract Tester 🌟       ║
╚════════════════════════════════════════════════════╝${c.reset}

  ${c.green}1${c.reset} generate   - Crear cuenta de prueba
  ${c.green}2${c.reset} load       - Cargar cuenta existente  
  ${c.green}3${c.reset} health     - Verificar contrato
  ${c.green}4${c.reset} create     - Crear pocket
  ${c.green}5${c.reset} deposit    - Depositar
  ${c.green}6${c.reset} withdraw   - Retirar
  ${c.green}7${c.reset} get        - Consultar pocket
  ${c.green}8${c.reset} contract   - Cambiar contract ID
  ${c.green}0${c.reset} exit       - Salir
`);

  let run = true;
  while (run) {
    const cmd = (await ask(`\n${c.cyan}> ${c.reset}`)).trim();
    switch (cmd) {
      case '1': case 'generate': await t.generateAccount(); break;
      case '2': case 'load': 
        const s = await ask('  Secret Key: '); 
        await t.loadAccount(s.trim()); 
        break;
      case '3': case 'health': await t.health(); break;
      case '4': case 'create':
        const goal = await ask('  Meta (stroops, 10000000=1XLM): ');
        await t.createPocket(goal.trim());
        break;
      case '5': case 'deposit':
        const did = await ask('  Pocket ID: ');
        const damt = await ask('  Cantidad (stroops): ');
        await t.deposit(did.trim(), damt.trim());
        break;
      case '6': case 'withdraw':
        const wid = await ask('  Pocket ID: ');
        const wamt = await ask('  Cantidad (stroops): ');
        await t.withdraw(wid.trim(), wamt.trim());
        break;
      case '7': case 'get':
        const gid = await ask('  Pocket ID: ');
        await t.getPocket(gid.trim());
        break;
      case '8': case 'contract':
        const nc = await ask('  Nuevo Contract ID: ');
        t.setContract(nc.trim());
        break;
      case '0': case 'exit': case 'q':
        run = false;
        console.log(`\n${c.green}👋 ¡Hasta luego!${c.reset}\n`);
        break;
      default: log.warn('Comando inválido');
    }
  }
  rl.close();
}

runCLI().catch(console.error);
