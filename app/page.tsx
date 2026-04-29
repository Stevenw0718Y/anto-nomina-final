'use client'

import { useState, useEffect, useCallback } from 'react'

// --- CONSTANTES ---
const PORCENTAJES_ARL_DEFAULT: Record<string, number> = {
  'I': 0.522,
  'II': 1.044,
  'III': 2.436,
  'IV': 4.350,
  'V': 6.960
}

const CONFIG_DEFAULT = {
  smmlv: 1750905,
  auxilioTransporte: 249095,
  umbralRetencion: 4490000,
  porcentajeRetencion: 10,
  porcentajesArl: { ...PORCENTAJES_ARL_DEFAULT },
  aplicarSENA: true,
  aplicarICBF: true,
  aplicarCaja: true
}

const ESTADO_INICIAL = {
  nombre: 'Juan Perez',
  salarioBase: 2500000,
  diasTrabajados: 30,
  horasExtraDiurnas: 4,
  horasExtraNocturnas: 2,
  horasDominicalesDiurnas: 8,
  horasDominicalesNocturnas: 0,
  recargosNocturnos: 6,
  bonificaciones: 200000,
  comisiones: 150000,
  nivelArl: 'I'
}

// --- LÓGICA DE NEGOCIO ---
interface InputsNomina {
  nombre: string
  salarioBase: number
  diasTrabajados: number
  horasExtraDiurnas: number
  horasExtraNocturnas: number
  horasDominicalesDiurnas: number
  horasDominicalesNocturnas: number
  recargosNocturnos: number
  bonificaciones: number
  comisiones: number
  nivelArl: string
}

interface ConfigNomina {
  smmlv: number
  auxilioTransporte: number
  umbralRetencion: number
  porcentajeRetencion: number
  porcentajesArl: Record<string, number>
  aplicarSENA: boolean
  aplicarICBF: boolean
  aplicarCaja: boolean
}

interface ResultadoNomina {
  // Valores base
  valorHora: number
  salarioProporcional: number
  auxilioTransporteCalculado: number
  aplicaAuxilio: boolean
  
  // Horas extra desglose
  valorHorasExtraDiurnas: number
  valorHorasExtraNocturnas: number
  valorRecargosNocturnos: number
  valorHorasDominicalesDiurnas: number
  valorHorasDominicalesNocturnas: number
  totalHorasExtra: number
  
  // Devengado
  totalDevengado: number
  
  // Base cotización
  baseCotizacion: number
  
  // Deducciones empleado
  saludEmpleado: number
  pensionEmpleado: number
  retencionFuente: number
  totalDeducciones: number
  
  // Neto
  netoPagar: number
  
  // Aportes empleador
  saludEmpleador: number
  pensionEmpleador: number
  arl: number
  caja: number
  icbf: number
  sena: number
  totalAportesEmpleador: number
  
  // Prestaciones
  cesantias: number
  interesesCesantias: number
  prima: number
  vacaciones: number
  totalPrestaciones: number
  
  // Costo total
  costoTotalEmpresa: number
  
  // Metadata
  nivelArl: string
  porcentajeArl: number
}

function calcularNomina(inputs: InputsNomina, config: ConfigNomina): ResultadoNomina {
  // Validar y sanitizar inputs
  const salarioBase = Math.max(inputs.salarioBase || 0, 0)
  const diasTrabajados = Math.min(Math.max(inputs.diasTrabajados || 0, 0), 30)
  const horasExtraDiurnas = Math.max(inputs.horasExtraDiurnas || 0, 0)
  const horasExtraNocturnas = Math.max(inputs.horasExtraNocturnas || 0, 0)
  const horasDominicalesDiurnas = Math.max(inputs.horasDominicalesDiurnas || 0, 0)
  const horasDominicalesNocturnas = Math.max(inputs.horasDominicalesNocturnas || 0, 0)
  const recargosNocturnos = Math.max(inputs.recargosNocturnos || 0, 0)
  const bonificaciones = Math.max(inputs.bonificaciones || 0, 0)
  const comisiones = Math.max(inputs.comisiones || 0, 0)
  
  // Valor hora (240 = 30 días × 8 horas)
  const valorHora = salarioBase / 240
  
  // Salario proporcional
  const salarioProporcional = salarioBase * (diasTrabajados / 30)
  
  // Auxilio de transporte
  const aplicaAuxilio = salarioBase <= 2 * config.smmlv
  const auxilioTransporteCalculado = aplicaAuxilio 
    ? config.auxilioTransporte * (diasTrabajados / 30) 
    : 0
  
  // Parafiscales aplican solo cuando el salario base supera 10 SMMLV
  const aplicaParafiscales = salarioBase > 10 * config.smmlv

  // Recargos por hora
  const valorHorasExtraDiurnas = horasExtraDiurnas * valorHora * 1.25
  const valorHorasExtraNocturnas = horasExtraNocturnas * valorHora * 1.75
  const valorRecargosNocturnos = recargosNocturnos * valorHora * 1.35
  const valorHorasDominicalesDiurnas = horasDominicalesDiurnas * valorHora * 2.00
  const valorHorasDominicalesNocturnas = horasDominicalesNocturnas * valorHora * 2.50

  const totalHorasExtra = valorHorasExtraDiurnas + valorHorasExtraNocturnas + 
    valorRecargosNocturnos + valorHorasDominicalesDiurnas + valorHorasDominicalesNocturnas
  
  // Total devengado
  const totalDevengado = salarioProporcional + totalHorasExtra + auxilioTransporteCalculado + 
    bonificaciones + comisiones
  
  // Base de cotización (NO incluye auxilio ni bonificaciones)
  let baseCotizacion = salarioProporcional + totalHorasExtra + comisiones
  const smmlvProporcional = config.smmlv * (diasTrabajados / 30)
  baseCotizacion = Math.max(baseCotizacion, smmlvProporcional)
  baseCotizacion = Math.min(baseCotizacion, 25 * config.smmlv)
  
  // Deducciones empleado
  const saludEmpleado = baseCotizacion * 0.04
  const pensionEmpleado = baseCotizacion * 0.04
  
  // Retención en la fuente
  let retencionFuente = 0
  if (totalDevengado > config.umbralRetencion) {
    retencionFuente = (totalDevengado - config.umbralRetencion) * (config.porcentajeRetencion / 100)
  }
  
  const totalDeducciones = saludEmpleado + pensionEmpleado + retencionFuente
  
  // Neto a pagar
  const netoPagar = totalDevengado - totalDeducciones
  
  // Aportes empleador
  const porcentajeArl = config.porcentajesArl[inputs.nivelArl] || config.porcentajesArl['I']
  const saludEmpleador = baseCotizacion * 0.085
  const pensionEmpleador = baseCotizacion * 0.12
  const arl = baseCotizacion * (porcentajeArl / 100)
  const caja = config.aplicarCaja ? baseCotizacion * 0.04 : 0
  const icbf = config.aplicarICBF && aplicaParafiscales ? baseCotizacion * 0.03 : 0
  const sena = config.aplicarSENA && aplicaParafiscales ? baseCotizacion * 0.02 : 0
  
  const totalAportesEmpleador = saludEmpleador + pensionEmpleador + arl + caja + icbf + sena
  
  // Prestaciones sociales
  const cesantias = salarioProporcional * 0.0833
  const interesesCesantias = cesantias * 0.12
  const prima = salarioProporcional * 0.0833
  const vacaciones = salarioProporcional * 0.0417
  
  const totalPrestaciones = cesantias + interesesCesantias + prima + vacaciones
  
  // Costo total empresa
  const costoTotalEmpresa = salarioProporcional + auxilioTransporteCalculado + totalHorasExtra + 
    bonificaciones + comisiones + totalAportesEmpleador + totalPrestaciones
  
  return {
    valorHora: Number(valorHora.toFixed(2)),
    salarioProporcional: Number(salarioProporcional.toFixed(2)),
    auxilioTransporteCalculado: Number(auxilioTransporteCalculado.toFixed(2)),
    aplicaAuxilio,
    valorHorasExtraDiurnas: Number(valorHorasExtraDiurnas.toFixed(2)),
    valorHorasExtraNocturnas: Number(valorHorasExtraNocturnas.toFixed(2)),
    valorRecargosNocturnos: Number(valorRecargosNocturnos.toFixed(2)),
    valorHorasDominicalesDiurnas: Number(valorHorasDominicalesDiurnas.toFixed(2)),
    valorHorasDominicalesNocturnas: Number(valorHorasDominicalesNocturnas.toFixed(2)),
    totalHorasExtra: Number(totalHorasExtra.toFixed(2)),
    totalDevengado: Number(totalDevengado.toFixed(2)),
    baseCotizacion: Number(baseCotizacion.toFixed(2)),
    saludEmpleado: Number(saludEmpleado.toFixed(2)),
    pensionEmpleado: Number(pensionEmpleado.toFixed(2)),
    retencionFuente: Number(retencionFuente.toFixed(2)),
    totalDeducciones: Number(totalDeducciones.toFixed(2)),
    netoPagar: Number(netoPagar.toFixed(2)),
    saludEmpleador: Number(saludEmpleador.toFixed(2)),
    pensionEmpleador: Number(pensionEmpleador.toFixed(2)),
    arl: Number(arl.toFixed(2)),
    caja: Number(caja.toFixed(2)),
    icbf: Number(icbf.toFixed(2)),
    sena: Number(sena.toFixed(2)),
    totalAportesEmpleador: Number(totalAportesEmpleador.toFixed(2)),
    cesantias: Number(cesantias.toFixed(2)),
    interesesCesantias: Number(interesesCesantias.toFixed(2)),
    prima: Number(prima.toFixed(2)),
    vacaciones: Number(vacaciones.toFixed(2)),
    totalPrestaciones: Number(totalPrestaciones.toFixed(2)),
    costoTotalEmpresa: Number(costoTotalEmpresa.toFixed(2)),
    nivelArl: inputs.nivelArl,
    porcentajeArl
  }
}

function formatCOP(valor: number): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0
  }).format(valor)
}

// --- ESTILOS GLOBALES ---
const THEME = {
  bg: '#0a0a0f',
  bgCard: '#12121a',
  bgCardAlt: '#1a1a25',
  cyan: '#00d4ff',
  cyanDark: '#0099cc',
  cyanLight: '#66e5ff',
  white: '#ffffff',
  grayLight: '#94a3b8',
  grayMed: '#64748b',
  verde: '#10b981',
  rojo: '#ef4444',
  azul: '#3b82f6',
  gris: '#6b7280'
}

// --- COMPONENTES ---
interface HeaderProps {
  anioVigente: number
}

function Header({ anioVigente }: HeaderProps) {
  return (
    <header style={{ 
      background: `linear-gradient(135deg, ${THEME.bg} 0%, #0d1a2a 50%, ${THEME.bg} 100%)`,
      borderBottom: `1px solid ${THEME.cyan}30`
    }} className="py-4 mb-4">
      <div className="container">
        <div className="d-flex justify-content-between align-items-center">
          <div className="d-flex align-items-center gap-3">
            <img 
              src="/images/somas-group-logo.png" 
              alt="Somas Group" 
              style={{ height: '50px', width: 'auto' }}
            />
            <div>
              <h1 style={{ color: THEME.cyan }} className="mb-0 fw-bold">ANTO-NOMINA</h1>
              <p style={{ color: THEME.grayLight }} className="mb-0 small">Calculadora de Nomina Colombia</p>
            </div>
          </div>
          <span 
            className="badge fs-6 px-3 py-2"
            style={{ 
              background: `${THEME.cyan}20`,
              color: THEME.cyan,
              border: `1px solid ${THEME.cyan}50`
            }}
          >
            {anioVigente}
          </span>
        </div>
      </div>
    </header>
  )
}

interface FormularioProps {
  inputs: InputsNomina
  setInputs: React.Dispatch<React.SetStateAction<InputsNomina>>
  config: ConfigNomina
  setConfig: React.Dispatch<React.SetStateAction<ConfigNomina>>
  onCalcular: () => void
}

function Formulario({ inputs, setInputs, config, setConfig, onCalcular }: FormularioProps) {
  // Helper para parsear valor numérico - solo permite dígitos
  const parseNumericValue = (value: string): number => {
    if (value === '' || value === null || value === undefined) return 0
    // Solo mantener dígitos
    const digitsOnly = value.replace(/\D/g, '')
    if (digitsOnly === '') return 0
    return parseInt(digitsOnly, 10)
  }
  
  // Helper para mostrar valor en input - string vacío si es 0
  const displayValue = (value: number): string => {
    return value === 0 ? '' : String(value)
  }
  
  const handleInputChange = (field: keyof InputsNomina, value: string | number) => {
    if (field === 'diasTrabajados') {
      const parsedValue = typeof value === 'string' ? parseNumericValue(value) : Number(value)
      const clampedValue = parsedValue > 30 ? 30 : parsedValue
      if (parsedValue > 30) {
        alert('El máximo de días permitidos por periodo mensual es 30.')
      }
      setInputs(prev => ({ ...prev, diasTrabajados: clampedValue }))
      return
    }

    if (typeof value === 'string' && field !== 'nombre' && field !== 'nivelArl') {
      setInputs(prev => ({ ...prev, [field]: parseNumericValue(value) }))
    } else {
      setInputs(prev => ({ ...prev, [field]: value }))
    }
  }
  
  const handleConfigChange = (field: keyof ConfigNomina, value: string | number | boolean) => {
    if (typeof value === 'string' && field !== 'aplicarSENA' && field !== 'aplicarICBF' && field !== 'aplicarCaja') {
      setConfig(prev => ({ ...prev, [field]: parseNumericValue(value) }))
    } else {
      setConfig(prev => ({ ...prev, [field]: value }))
    }
  }
  
  const handleArlChange = (nivel: string, value: string) => {
    const numValue = parseFloat(value)
    setConfig(prev => ({
      ...prev,
      porcentajesArl: {
        ...prev.porcentajesArl,
        [nivel]: isNaN(numValue) ? 0 : numValue
      }
    }))
  }
  
  return (
    <div className="card shadow-lg" style={{ backgroundColor: THEME.bgCard, border: `1px solid ${THEME.cyan}30` }}>
      <div className="card-header" style={{ backgroundColor: THEME.bgCardAlt, borderBottom: `1px solid ${THEME.cyan}40` }}>
        <h5 className="mb-0" style={{ color: THEME.cyan }}>
          Datos de Nomina
        </h5>
      </div>
      <div className="card-body" style={{ color: THEME.white }}>
        {/* Datos del empleado */}
        <h6 style={{ color: THEME.cyanLight, borderBottom: `1px solid ${THEME.cyan}30` }} className="pb-2 mb-3">Datos del Empleado</h6>
        <div className="mb-3">
          <label className="form-label" style={{ color: THEME.grayLight }}>Nombre del empleado</label>
          <input
            type="text"
            className="form-control"
            style={{ backgroundColor: THEME.bgCardAlt, border: `1px solid ${THEME.cyan}30`, color: THEME.white }}
            value={inputs.nombre}
            onChange={(e) => handleInputChange('nombre', e.target.value)}
          />
        </div>
        <div className="row mb-3">
          <div className="col-md-6 mb-3 mb-md-0">
            <label className="form-label" style={{ color: THEME.grayLight }}>Salario base mensual</label>
            <div className="input-group">
              <span className="input-group-text" style={{ backgroundColor: THEME.cyan, color: THEME.bg, border: 'none' }}>$</span>
              <input
                type="text"
                inputMode="numeric"
                className="form-control"
                style={{ backgroundColor: THEME.bgCardAlt, border: `1px solid ${THEME.cyan}30`, color: THEME.white }}
                value={displayValue(inputs.salarioBase)}
                onChange={(e) => handleInputChange('salarioBase', e.target.value)}
                placeholder="0"
              />
            </div>
          </div>
          <div className="col-md-6">
            <label className="form-label" style={{ color: THEME.grayLight }}>Dias trabajados</label>
            <input
              type="text"
              inputMode="numeric"
              className="form-control"
              style={{ backgroundColor: THEME.bgCardAlt, border: `1px solid ${THEME.cyan}30`, color: THEME.white }}
              value={displayValue(inputs.diasTrabajados)}
              onChange={(e) => handleInputChange('diasTrabajados', e.target.value)}
              placeholder="30"
            />
          </div>
        </div>
        
        {/* Variables salariales */}
        <h6 style={{ color: THEME.cyanLight, borderBottom: `1px solid ${THEME.cyan}30` }} className="pb-2 mb-3 mt-4">Variables Salariales</h6>
        <div className="row g-2 mb-3">
          <div className="col-6 col-md-4">
            <label className="form-label small" style={{ color: THEME.grayLight }}>Horas extra diurnas</label>
            <input
              type="text"
              inputMode="numeric"
              className="form-control form-control-sm"
              style={{ backgroundColor: THEME.bgCardAlt, border: `1px solid ${THEME.cyan}30`, color: THEME.white }}
              value={displayValue(inputs.horasExtraDiurnas)}
              onChange={(e) => handleInputChange('horasExtraDiurnas', e.target.value)}
              placeholder="0"
            />
          </div>
          <div className="col-6 col-md-4">
            <label className="form-label small" style={{ color: THEME.grayLight }}>Horas extra nocturnas</label>
            <input
              type="text"
              inputMode="numeric"
              className="form-control form-control-sm"
              style={{ backgroundColor: THEME.bgCardAlt, border: `1px solid ${THEME.cyan}30`, color: THEME.white }}
              value={displayValue(inputs.horasExtraNocturnas)}
              onChange={(e) => handleInputChange('horasExtraNocturnas', e.target.value)}
              placeholder="0"
            />
          </div>
          <div className="col-6 col-md-4">
            <label className="form-label small" style={{ color: THEME.grayLight }}>Recargos nocturnos</label>
            <input
              type="text"
              inputMode="numeric"
              className="form-control form-control-sm"
              style={{ backgroundColor: THEME.bgCardAlt, border: `1px solid ${THEME.cyan}30`, color: THEME.white }}
              value={displayValue(inputs.recargosNocturnos)}
              onChange={(e) => handleInputChange('recargosNocturnos', e.target.value)}
              placeholder="0"
            />
          </div>
          <div className="col-6 col-md-4">
            <label className="form-label small" style={{ color: THEME.grayLight }}>H. dominicales diurnas</label>
            <input
              type="text"
              inputMode="numeric"
              className="form-control form-control-sm"
              style={{ backgroundColor: THEME.bgCardAlt, border: `1px solid ${THEME.cyan}30`, color: THEME.white }}
              value={displayValue(inputs.horasDominicalesDiurnas)}
              onChange={(e) => handleInputChange('horasDominicalesDiurnas', e.target.value)}
              placeholder="0"
            />
          </div>
          <div className="col-6 col-md-4">
            <label className="form-label small" style={{ color: THEME.grayLight }}>H. dominicales nocturnas</label>
            <input
              type="text"
              inputMode="numeric"
              className="form-control form-control-sm"
              style={{ backgroundColor: THEME.bgCardAlt, border: `1px solid ${THEME.cyan}30`, color: THEME.white }}
              value={displayValue(inputs.horasDominicalesNocturnas)}
              onChange={(e) => handleInputChange('horasDominicalesNocturnas', e.target.value)}
              placeholder="0"
            />
          </div>
          <div className="col-6 col-md-4">
            <label className="form-label small" style={{ color: THEME.grayLight }}>Nivel ARL</label>
            <select
              className="form-select form-select-sm"
              style={{ backgroundColor: THEME.bgCardAlt, border: `1px solid ${THEME.cyan}30`, color: THEME.white }}
              value={inputs.nivelArl}
              onChange={(e) => handleInputChange('nivelArl', e.target.value)}
            >
              <option value="I">Nivel I</option>
              <option value="II">Nivel II</option>
              <option value="III">Nivel III</option>
              <option value="IV">Nivel IV</option>
              <option value="V">Nivel V</option>
            </select>
          </div>
        </div>
        
        <div className="row mb-3">
          <div className="col-6">
            <label className="form-label" style={{ color: THEME.grayLight }}>Bonificaciones</label>
            <div className="input-group">
              <span className="input-group-text" style={{ backgroundColor: THEME.cyan, color: THEME.bg, border: 'none' }}>$</span>
              <input
                type="text"
                inputMode="numeric"
                className="form-control"
                style={{ backgroundColor: THEME.bgCardAlt, border: `1px solid ${THEME.cyan}30`, color: THEME.white }}
                value={displayValue(inputs.bonificaciones)}
                onChange={(e) => handleInputChange('bonificaciones', e.target.value)}
                placeholder="0"
              />
            </div>
          </div>
          <div className="col-6">
            <label className="form-label" style={{ color: THEME.grayLight }}>Comisiones</label>
            <div className="input-group">
              <span className="input-group-text" style={{ backgroundColor: THEME.cyan, color: THEME.bg, border: 'none' }}>$</span>
              <input
                type="text"
                inputMode="numeric"
                className="form-control"
                style={{ backgroundColor: THEME.bgCardAlt, border: `1px solid ${THEME.cyan}30`, color: THEME.white }}
                value={displayValue(inputs.comisiones)}
                onChange={(e) => handleInputChange('comisiones', e.target.value)}
                placeholder="0"
              />
            </div>
          </div>
        </div>
        
        {/* Configuracion avanzada - Acordeon */}
        <div className="accordion mt-4" id="configAccordion">
          <div className="accordion-item" style={{ backgroundColor: THEME.bgCardAlt, border: `1px solid ${THEME.cyan}30` }}>
            <h2 className="accordion-header">
              <button
                className="accordion-button collapsed"
                type="button"
                data-bs-toggle="collapse"
                data-bs-target="#configCollapse"
                aria-expanded="false"
                aria-controls="configCollapse"
                style={{ backgroundColor: THEME.bgCardAlt, color: THEME.cyanLight }}
              >
                Configuracion Avanzada
              </button>
            </h2>
            <div
              id="configCollapse"
              className="accordion-collapse collapse"
              data-bs-parent="#configAccordion"
            >
              <div className="accordion-body" style={{ backgroundColor: THEME.bgCard }}>
                <div className="row g-3 mb-3">
                  <div className="col-md-6">
                    <label className="form-label small" style={{ color: THEME.grayLight }}>SMMLV</label>
                    <div className="input-group input-group-sm">
                      <span className="input-group-text" style={{ backgroundColor: THEME.cyan, color: THEME.bg, border: 'none' }}>$</span>
                      <input
                        type="text"
                        inputMode="numeric"
                        className="form-control"
                        style={{ backgroundColor: THEME.bgCardAlt, border: `1px solid ${THEME.cyan}30`, color: THEME.white }}
                        value={displayValue(config.smmlv)}
                        onChange={(e) => handleConfigChange('smmlv', e.target.value)}
                        placeholder="0"
                      />
                    </div>
                  </div>
                  <div className="col-md-6">
                    <label className="form-label small" style={{ color: THEME.grayLight }}>Auxilio de transporte</label>
                    <div className="input-group input-group-sm">
                      <span className="input-group-text" style={{ backgroundColor: THEME.cyan, color: THEME.bg, border: 'none' }}>$</span>
                      <input
                        type="text"
                        inputMode="numeric"
                        className="form-control"
                        style={{ backgroundColor: THEME.bgCardAlt, border: `1px solid ${THEME.cyan}30`, color: THEME.white }}
                        value={displayValue(config.auxilioTransporte)}
                        onChange={(e) => handleConfigChange('auxilioTransporte', e.target.value)}
                        placeholder="0"
                      />
                    </div>
                  </div>
                  <div className="col-md-6">
                    <label className="form-label small" style={{ color: THEME.grayLight }}>Umbral retencion</label>
                    <div className="input-group input-group-sm">
                      <span className="input-group-text" style={{ backgroundColor: THEME.cyan, color: THEME.bg, border: 'none' }}>$</span>
                      <input
                        type="text"
                        inputMode="numeric"
                        className="form-control"
                        style={{ backgroundColor: THEME.bgCardAlt, border: `1px solid ${THEME.cyan}30`, color: THEME.white }}
                        value={displayValue(config.umbralRetencion)}
                        onChange={(e) => handleConfigChange('umbralRetencion', e.target.value)}
                        placeholder="0"
                      />
                    </div>
                  </div>
                  <div className="col-md-6">
                    <label className="form-label small" style={{ color: THEME.grayLight }}>% Retencion</label>
                    <div className="input-group input-group-sm">
                      <input
                        type="text"
                        inputMode="numeric"
                        className="form-control"
                        style={{ backgroundColor: THEME.bgCardAlt, border: `1px solid ${THEME.cyan}30`, color: THEME.white }}
                        value={displayValue(config.porcentajeRetencion)}
                        onChange={(e) => handleConfigChange('porcentajeRetencion', e.target.value)}
                        placeholder="0"
                      />
                      <span className="input-group-text" style={{ backgroundColor: THEME.cyan, color: THEME.bg, border: 'none' }}>%</span>
                    </div>
                  </div>
                </div>
                
                <h6 className="small mb-2" style={{ color: THEME.cyanLight }}>Porcentajes ARL por nivel</h6>
                <div className="row g-2 mb-3">
                  {Object.entries(config.porcentajesArl).map(([nivel, porcentaje]) => (
                    <div className="col-4 col-md-2" key={nivel}>
                      <label className="form-label small" style={{ color: THEME.grayLight }}>Nivel {nivel}</label>
                      <div className="input-group input-group-sm">
                        <input
                          type="number"
                          className="form-control"
                          style={{ backgroundColor: THEME.bgCardAlt, border: `1px solid ${THEME.cyan}30`, color: THEME.white }}
                          step="0.001"
                          min="0"
                          value={porcentaje}
                          onChange={(e) => handleArlChange(nivel, e.target.value)}
                        />
                        <span className="input-group-text" style={{ backgroundColor: THEME.cyan, color: THEME.bg, border: 'none' }}>%</span>
                      </div>
                    </div>
                  ))}
                </div>
                
                <h6 className="small mb-2" style={{ color: THEME.cyanLight }}>Aportes parafiscales</h6>
                <div className="d-flex flex-wrap gap-3">
                  <div className="form-check">
                    <input
                      className="form-check-input"
                      type="checkbox"
                      id="checkSENA"
                      checked={config.aplicarSENA}
                      onChange={(e) => handleConfigChange('aplicarSENA', e.target.checked)}
                      style={{ backgroundColor: config.aplicarSENA ? THEME.cyan : THEME.bgCardAlt, borderColor: THEME.cyan }}
                    />
                    <label className="form-check-label" htmlFor="checkSENA" style={{ color: THEME.grayLight }}>
                      SENA (2%)
                    </label>
                  </div>
                  <div className="form-check">
                    <input
                      className="form-check-input"
                      type="checkbox"
                      id="checkICBF"
                      checked={config.aplicarICBF}
                      onChange={(e) => handleConfigChange('aplicarICBF', e.target.checked)}
                      style={{ backgroundColor: config.aplicarICBF ? THEME.cyan : THEME.bgCardAlt, borderColor: THEME.cyan }}
                    />
                    <label className="form-check-label" htmlFor="checkICBF" style={{ color: THEME.grayLight }}>
                      ICBF (3%)
                    </label>
                  </div>
                  <div className="form-check">
                    <input
                      className="form-check-input"
                      type="checkbox"
                      id="checkCaja"
                      checked={config.aplicarCaja}
                      onChange={(e) => handleConfigChange('aplicarCaja', e.target.checked)}
                      style={{ backgroundColor: config.aplicarCaja ? THEME.cyan : THEME.bgCardAlt, borderColor: THEME.cyan }}
                    />
                    <label className="form-check-label" htmlFor="checkCaja" style={{ color: THEME.grayLight }}>
                      Caja (4%)
                    </label>
                  </div>
                </div>
                <p className="small text-muted mt-2" style={{ lineHeight: 1.4 }}>
                  SENA e ICBF no se calculan cuando el salario base es igual o inferior a 10 SMMLV. El auxilio de transporte se aplica automáticamente para salarios hasta 2 SMMLV.
                </p>
              </div>
            </div>
          </div>
        </div>

        <button
          className="btn w-100 mt-4 fw-bold"
          style={{ 
            backgroundColor: THEME.cyan, 
            color: THEME.bg,
            border: 'none',
            boxShadow: `0 0 20px ${THEME.cyan}40`
          }}
          onClick={onCalcular}
        >
          Calcular Nomina
        </button>
      </div>
    </div>
  )
}

interface ResultadosProps {
  resultado: ResultadoNomina
  inputs: InputsNomina
  config: ConfigNomina
}

function Resultados({ resultado, inputs, config }: ResultadosProps) {
  return (
    <div className="d-flex flex-column gap-3">
      {/* Card Devengado */}
      <div className="card shadow-lg neon-card neon-card-devengado">
        <div className="card-header neon-header neon-header-devengado">
          <h6 className="mb-0">DEVENGADO</h6>
        </div>
        <div className="card-body">
          <table className="table table-sm mb-0" style={{ color: THEME.white }}>
            <tbody>
              <tr>
                <td>Salario proporcional</td>
                <td className="text-end">{formatCOP(resultado.salarioProporcional)}</td>
              </tr>
              <tr>
                <td>Total horas extra</td>
                <td className="text-end">{formatCOP(resultado.totalHorasExtra)}</td>
              </tr>
              {resultado.totalHorasExtra > 0 && (
                <tr>
                  <td colSpan={2}>
                    <table className="table table-sm table-borderless ms-3 mb-0 small text-muted">
                      <tbody>
                        {resultado.valorHorasExtraDiurnas > 0 && (
                          <tr>
                            <td>• Extra diurnas ({inputs.horasExtraDiurnas}h × 1.25)</td>
                            <td className="text-end">{formatCOP(resultado.valorHorasExtraDiurnas)}</td>
                          </tr>
                        )}
                        {resultado.valorHorasExtraNocturnas > 0 && (
                          <tr>
                            <td>• Extra nocturnas ({inputs.horasExtraNocturnas}h × 1.75)</td>
                            <td className="text-end">{formatCOP(resultado.valorHorasExtraNocturnas)}</td>
                          </tr>
                        )}
                        {resultado.valorRecargosNocturnos > 0 && (
                          <tr>
                            <td>• Recargos nocturnos ({inputs.recargosNocturnos}h × 1.35)</td>
                            <td className="text-end">{formatCOP(resultado.valorRecargosNocturnos)}</td>
                          </tr>
                        )}
                        {resultado.valorHorasDominicalesDiurnas > 0 && (
                          <tr>
                            <td>• Dominicales diurnas ({inputs.horasDominicalesDiurnas}h × 2.00)</td>
                            <td className="text-end">{formatCOP(resultado.valorHorasDominicalesDiurnas)}</td>
                          </tr>
                        )}
                        {resultado.valorHorasDominicalesNocturnas > 0 && (
                          <tr>
                            <td>• Dominicales nocturnas ({inputs.horasDominicalesNocturnas}h × 2.50)</td>
                            <td className="text-end">{formatCOP(resultado.valorHorasDominicalesNocturnas)}</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </td>
                </tr>
              )}
              <tr>
                <td>Auxilio de transporte</td>
                <td className="text-end">
                  {resultado.aplicaAuxilio ? formatCOP(resultado.auxilioTransporteCalculado) : <span className="text-muted">No aplica</span>}
                </td>
              </tr>
              <tr>
                <td>Bonificaciones</td>
                <td className="text-end">{formatCOP(inputs.bonificaciones)}</td>
              </tr>
              <tr>
                <td>Comisiones</td>
                <td className="text-end">{formatCOP(inputs.comisiones)}</td>
              </tr>
              <tr className="fw-bold neon-summary-row-devengado">
                <td>TOTAL DEVENGADO</td>
                <td className="text-end fs-5">{formatCOP(resultado.totalDevengado)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
      
      {/* Card Deducciones */}
      <div className="card shadow-lg neon-card neon-card-deducciones">
        <div className="card-header neon-header neon-header-deducciones">
          <h6 className="mb-0">DEDUCCIONES</h6>
        </div>
        <div className="card-body">
          <table className="table table-sm mb-0" style={{ color: THEME.white }}>
            <tbody>
              <tr>
                <td>Salud empleado (4%)</td>
                <td className="text-end">{formatCOP(resultado.saludEmpleado)}</td>
              </tr>
              <tr>
                <td>Pension empleado (4%)</td>
                <td className="text-end">{formatCOP(resultado.pensionEmpleado)}</td>
              </tr>
              <tr>
                <td>Retencion en la fuente</td>
                <td className="text-end">
                  {resultado.retencionFuente > 0 ? formatCOP(resultado.retencionFuente) : <span style={{ color: THEME.grayMed }}>N/A</span>}
                </td>
              </tr>
              <tr className="fw-bold neon-summary-row-deducciones">
                <td>TOTAL DEDUCCIONES</td>
                <td className="text-end fs-5">{formatCOP(resultado.totalDeducciones)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
      
      {/* Card Neto a Pagar */}
      <div className="card shadow-lg neon-card neon-card-neto">
        <div className="card-header neon-header neon-header-neto">
          <h6 className="mb-0">NETO A PAGAR</h6>
        </div>
        <div className="card-body text-center py-4">
          <h2 className="mb-2 neon-amount">{formatCOP(resultado.netoPagar)}</h2>
          <p className="mb-0 small neon-label">
            Este es el valor que recibira el empleado despues de deducciones
          </p>
        </div>
      </div>
      
      {/* Card Costo Empresa */}
      <div className="card shadow-lg neon-card neon-card-costo">
        <div className="card-header neon-header neon-header-costo">
          <h6 className="mb-0">COSTO EMPRESA</h6>
        </div>
        <div className="card-body">
          <h6 className="small mb-2" style={{ color: THEME.cyanLight }}>Aportes Empleador</h6>
          <table className="table table-sm" style={{ color: THEME.white }}>
            <tbody>
              <tr>
                <td>Salud empleador (8.5%)</td>
                <td className="text-end">{formatCOP(resultado.saludEmpleador)}</td>
              </tr>
              <tr>
                <td>Pensión empleador (12%)</td>
                <td className="text-end">{formatCOP(resultado.pensionEmpleador)}</td>
              </tr>
              <tr>
                <td>ARL (Nivel {resultado.nivelArl} - {resultado.porcentajeArl}%)</td>
                <td className="text-end">{formatCOP(resultado.arl)}</td>
              </tr>
              {config.aplicarCaja && (
                <tr>
                  <td>Caja de compensación (4%)</td>
                  <td className="text-end">{formatCOP(resultado.caja)}</td>
                </tr>
              )}
              {config.aplicarICBF && (
                <tr>
                  <td>ICBF (3%)</td>
                  <td className="text-end">{formatCOP(resultado.icbf)}</td>
                </tr>
              )}
              {config.aplicarSENA && (
                <tr>
                  <td>SENA (2%)</td>
                  <td className="text-end">{formatCOP(resultado.sena)}</td>
                </tr>
              )}
              <tr className="fw-bold" style={{ backgroundColor: `${THEME.cyan}10` }}>
                <td style={{ color: THEME.cyanLight }}>Total aportes empleador</td>
                <td className="text-end" style={{ color: THEME.cyan }}>{formatCOP(resultado.totalAportesEmpleador)}</td>
              </tr>
            </tbody>
          </table>
          
          <h6 className="small mb-2 mt-3" style={{ color: THEME.cyanLight }}>Prestaciones Sociales</h6>
          <table className="table table-sm" style={{ color: THEME.white }}>
            <tbody>
              <tr>
                <td>Cesantías (8.33%)</td>
                <td className="text-end">{formatCOP(resultado.cesantias)}</td>
              </tr>
              <tr>
                <td>Intereses cesantías (12%)</td>
                <td className="text-end">{formatCOP(resultado.interesesCesantias)}</td>
              </tr>
              <tr>
                <td>Prima (8.33%)</td>
                <td className="text-end">{formatCOP(resultado.prima)}</td>
              </tr>
              <tr>
                <td>Vacaciones (4.17%)</td>
                <td className="text-end">{formatCOP(resultado.vacaciones)}</td>
              </tr>
              <tr className="fw-bold" style={{ backgroundColor: `${THEME.cyan}10` }}>
                <td style={{ color: THEME.cyanLight }}>Total prestaciones</td>
                <td className="text-end" style={{ color: THEME.cyan }}>{formatCOP(resultado.totalPrestaciones)}</td>
              </tr>
            </tbody>
          </table>
          
          <div className="pt-3 mt-3" style={{ borderTop: `1px solid ${THEME.cyan}30` }}>
            <div className="d-flex justify-content-between align-items-center">
              <span className="fw-bold fs-5" style={{ color: THEME.white }}>TOTAL COSTO EMPRESA</span>
              <span className="fw-bold fs-4" style={{ color: THEME.cyan }}>{formatCOP(resultado.costoTotalEmpresa)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

interface BotonPDFProps {
  resultado: ResultadoNomina | null
  inputs: InputsNomina
  config: ConfigNomina
}

function BotonPDF({ resultado, inputs, config }: BotonPDFProps) {
  const generarPDF = useCallback(() => {
    if (!resultado) return
    
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const jspdf = (window as any).jspdf
    if (!jspdf) {
      alert('Error: jsPDF no esta cargado. Por favor recargue la pagina.')
      return
    }
    
    const { jsPDF } = jspdf
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const doc = new jsPDF({ unit: 'mm', format: 'letter' }) as any
    
    // Paleta de colores - tema pastel sobrio
    const COLORS = {
      OSCURO: '#F8F9FA',       // Very light gray (replaced dark)
      CYAN: '#87CEEB',        // Sky blue pastel
      CYAN_DARK: '#4682B4',   // Steel blue
      CYAN_LIGHT: '#B0E0E6',  // Powder blue
      VERDE: '#98FB98',       // Pale green
      AZUL: '#87CEEB',        // Sky blue pastel
      AZUL_LIGHT: '#F0F8FF',  // Alice blue
      ROJO: '#FFB6C1',        // Light pink
      GRIS: '#708090',        // Slate gray
      GRIS_LIGHT: '#F5F5F5',  // White smoke (replaced dark)
      GRIS_MED: '#D3D3D3',    // Light gray
      AMARILLO: '#F0E68C',    // Khaki
      AMARILLO_L: '#FFFACD',  // Lemon chiffon
      PURPURA: '#DDA0DD',     // Plum
      PURPURA_L: '#E6E6FA',   // Lavender
      ZEBRA: '#FAFAFA',       // Very light gray
      SLATE: '#708090',       // Slate gray
      BLANCO: '#ffffff',
      SLATE_LIGHT: '#B0C4DE', // Light steel blue
      SLATE_MED: '#778899',   // Light slate gray
      TEXTO_OSCURO: '#2F4F4F', // Dark slate gray - for high contrast text
      TEXTO_MEDIO: '#696969',  // Dim gray - for secondary text
      NEGRO: '#000000'         // Pure black for name text
    }
    
    // Dimensiones
    const PAGE_WIDTH = 215.9
    const PAGE_HEIGHT = 279.4
    const MARGIN_LEFT = 20
    const MARGIN_RIGHT = 195.9
    const CONTENT_WIDTH = 175.9
    const ROW_H = 8
    const FOOTER_HEIGHT = 15
    const MAX_CONTENT_Y = PAGE_HEIGHT - FOOTER_HEIGHT - 10
    
    // Funcion para verificar y agregar nueva pagina si es necesario
    const checkPageBreak = (neededHeight: number) => {
      if (cursorY + neededHeight > MAX_CONTENT_Y) {
        // Dibujar footer en pagina actual antes de agregar nueva
        drawFooter()
        doc.addPage()
        cursorY = 20
      }
    }
    
    // Funcion para dibujar el footer
    const drawFooter = () => {
      setFillColor(COLORS.GRIS_LIGHT)  // Changed from OSCURO to GRIS_LIGHT for pastel theme
      doc.rect(0, PAGE_HEIGHT - FOOTER_HEIGHT, PAGE_WIDTH, FOOTER_HEIGHT, 'F')
      
      // Linea superior cyan
      setDrawColor(COLORS.CYAN_LIGHT)  // Changed from CYAN to CYAN_LIGHT for softer look
      doc.setLineWidth(0.5)
      doc.line(0, PAGE_HEIGHT - FOOTER_HEIGHT, PAGE_WIDTH, PAGE_HEIGHT - FOOTER_HEIGHT)
      
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(7)
      setTextColor(COLORS.TEXTO_OSCURO)  // Changed from SLATE_MED to TEXTO_OSCURO for better contrast
      doc.text('Generado por ANTO-NOMINA | Somas Group', PAGE_WIDTH / 2, PAGE_HEIGHT - 10, { align: 'center' })
      setTextColor(COLORS.TEXTO_MEDIO)  // Changed from GRIS to TEXTO_MEDIO for better contrast
      doc.text(`Este documento es informativo | Consulte a su contador | ${new Date().toLocaleString('es-CO')}`, PAGE_WIDTH / 2, PAGE_HEIGHT - 5, { align: 'center' })
    }
    
    // Función helper para setear colores hex
    const hexToRgb = (hex: string) => {
      const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
      return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
      } : { r: 0, g: 0, b: 0 }
    }
    
    const setFillColor = (hex: string) => {
      const { r, g, b } = hexToRgb(hex)
      doc.setFillColor(r, g, b)
    }
    
    const setTextColor = (hex: string) => {
      const { r, g, b } = hexToRgb(hex)
      doc.setTextColor(r, g, b)
    }
    
    const setDrawColor = (hex: string) => {
      const { r, g, b } = hexToRgb(hex)
      doc.setDrawColor(r, g, b)
    }
    
    // Funcion formatCOP para PDF
    const formatCOPpdf = (valor: number): string => {
      if (valor === 0 || valor === null || valor === undefined) return 'N/A'
      return new Intl.NumberFormat('es-CO', {
        style: 'currency',
        currency: 'COP',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      }).format(valor)
    }
    
    let cursorY = 0
    
    // ===== SECCION 1: HEADER (y=0 a y=38mm) =====
    
    // Fondo completo del header - degradado simulado
    setFillColor(COLORS.AZUL_LIGHT)  // Changed from OSCURO to AZUL_LIGHT for pastel theme
    doc.rect(0, 0, PAGE_WIDTH, 38, 'F')
    
    // Linea superior cyan
    setFillColor(COLORS.CYAN_LIGHT)  // Changed from CYAN to CYAN_LIGHT for softer pastel look
    doc.rect(0, 0, PAGE_WIDTH, 1.5, 'F')
    
    // Texto "ANTO-NOMINA" con estilo cyan
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(20)
    setTextColor(COLORS.CYAN_DARK)  // Changed from CYAN to CYAN_DARK for better contrast
    doc.text('ANTO-NOMINA', 25, 16)
    
    // Subtitulo
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    setTextColor(COLORS.TEXTO_OSCURO)  // Changed from SLATE_MED to TEXTO_OSCURO for better contrast
    doc.text('Comprobante de Nomina | Colombia | Somas Group', 25, 24)
    
    // Fecha (derecha)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    setTextColor(COLORS.CYAN_DARK)  // Changed from CYAN to CYAN_DARK for better contrast
    doc.text(`Fecha: ${new Date().toLocaleDateString('es-CO')}`, MARGIN_RIGHT, 15, { align: 'right' })
    
    // Periodo (derecha)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    setTextColor(COLORS.TEXTO_MEDIO)  // Changed from SLATE_LIGHT to TEXTO_MEDIO for better contrast
    doc.text(`Periodo: ${inputs.diasTrabajados} dias trabajados`, MARGIN_RIGHT, 23, { align: 'right' })
    
    // Linea inferior del header cyan
    setDrawColor(COLORS.CYAN)
    doc.setLineWidth(0.5)
    doc.line(0, 38, PAGE_WIDTH, 38)
    
    cursorY = 44
    
    // ===== SECCION 2: BLOQUE EMPLEADO =====
    
    // Fondo oscuro
    setFillColor(COLORS.GRIS_LIGHT)
    doc.rect(MARGIN_LEFT, cursorY, CONTENT_WIDTH, 18, 'F')
    
    // Borde cyan
    setDrawColor(COLORS.CYAN_DARK)
    doc.setLineWidth(0.5)
    doc.rect(MARGIN_LEFT, cursorY, CONTENT_WIDTH, 18, 'S')
    
    // Linea divisoria vertical cyan
    setDrawColor(COLORS.CYAN_DARK)
    doc.line(50, cursorY, 50, cursorY + 18)
    
    // Fila 1 - Empleado
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7.5)
    setTextColor(COLORS.CYAN)
    doc.text('Empleado', 22, cursorY + 6)
    
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    setTextColor(COLORS.NEGRO)  // Changed from BLANCO to NEGRO for name text
    doc.text(inputs.nombre, 53, cursorY + 6)
    
    // Fila 2 - Periodo
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7.5)
    setTextColor(COLORS.CYAN)
    doc.text('Periodo', 22, cursorY + 13)
    
    doc.setFontSize(9)
    setTextColor(COLORS.TEXTO_MEDIO)  // Changed from SLATE_LIGHT to TEXTO_MEDIO for better contrast
    doc.text(`Mes en curso - ${inputs.diasTrabajados} dias trabajados`, 53, cursorY + 13)
    
    cursorY += 24
    
    // ===== FUNCION GENERICA: drawSectionCard =====
    const drawSectionCard = (
      titulo: string,
      colorHeader: string,
      filas: Array<{ concepto: string; valor: string }>,
      totalLabel: string,
      totalValor: string
    ) => {
      // Calcular altura total de la tarjeta
      const cardHeight = 9 + (filas.length * ROW_H) + 9
      checkPageBreak(cardHeight)
      
      const cardStartY = cursorY
      
      // Badge (encabezado)
      setFillColor(colorHeader)
      doc.rect(MARGIN_LEFT, cursorY, CONTENT_WIDTH, 9, 'F')
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(9)
      setTextColor(COLORS.BLANCO)
      doc.text(titulo, 24, cursorY + 6)
      cursorY += 9
      
      // Filas
      filas.forEach((fila, i) => {
        // Zebra striping
        if (i % 2 === 1) {
          setFillColor(COLORS.ZEBRA)
          doc.rect(MARGIN_LEFT, cursorY, CONTENT_WIDTH, ROW_H, 'F')
        }
        
        // Separador inferior
        setDrawColor(COLORS.GRIS_MED)
        doc.setLineWidth(0.3)
        doc.line(MARGIN_LEFT, cursorY + ROW_H, MARGIN_RIGHT, cursorY + ROW_H)
        
        // Concepto
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(9)
        setTextColor(COLORS.TEXTO_OSCURO)  // Changed from SLATE_MED to TEXTO_OSCURO for better contrast
        doc.text(fila.concepto, 24, cursorY + 5.5)
        
        // Valor
        doc.setFont('helvetica', 'bold')
        setTextColor(COLORS.TEXTO_MEDIO)  // Changed from GRIS to TEXTO_MEDIO for better contrast
        doc.text(fila.valor, MARGIN_RIGHT, cursorY + 5.5, { align: 'right' })
        
        cursorY += ROW_H
      })
      
      // Fila total
      setFillColor(colorHeader)
      doc.rect(MARGIN_LEFT, cursorY, CONTENT_WIDTH, 9, 'F')
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(9)
      setTextColor(COLORS.BLANCO)
      doc.text(totalLabel, 24, cursorY + 6)
      doc.text(totalValor, MARGIN_RIGHT, cursorY + 6, { align: 'right' })
      cursorY += 9
      
      // Borde exterior
      const cardTotalHeight = cursorY - cardStartY
      setDrawColor(colorHeader)
      doc.setLineWidth(0.5)
      doc.rect(MARGIN_LEFT, cardStartY, CONTENT_WIDTH, cardTotalHeight, 'S')
      
      cursorY += 5
    }
    
    // ===== SECCION 3: DEVENGADO =====
    const devengadoFilas = [
      { concepto: 'Salario base proporcional', valor: formatCOPpdf(resultado.salarioProporcional) },
      { concepto: 'Horas extra (todos los tipos)', valor: formatCOPpdf(resultado.totalHorasExtra) },
      { concepto: 'Auxilio de transporte', valor: resultado.aplicaAuxilio ? formatCOPpdf(resultado.auxilioTransporteCalculado) : 'N/A' },
      { concepto: 'Bonificaciones', valor: formatCOPpdf(inputs.bonificaciones) },
      { concepto: 'Comisiones', valor: formatCOPpdf(inputs.comisiones) }
    ]
    
    drawSectionCard('DEVENGADO', COLORS.VERDE, devengadoFilas, 'TOTAL DEVENGADO', formatCOPpdf(resultado.totalDevengado))
    
    // ===== SECCION 4: DEDUCCIONES =====
    const deduccionesFilas = [
      { concepto: 'Salud empleado (4%)', valor: formatCOPpdf(resultado.saludEmpleado) },
      { concepto: 'Pension empleado (4%)', valor: formatCOPpdf(resultado.pensionEmpleado) },
      { concepto: 'Retencion en la fuente', valor: resultado.retencionFuente > 0 ? formatCOPpdf(resultado.retencionFuente) : 'N/A' }
    ]
    
    drawSectionCard('DEDUCCIONES', COLORS.ROJO, deduccionesFilas, 'TOTAL DEDUCCIONES', formatCOPpdf(resultado.totalDeducciones))
    
    // ===== SECCION 5: NETO A PAGAR =====
    checkPageBreak(36)
    const netoStartY = cursorY
    
    // Badge azul
    setFillColor(COLORS.AZUL)
    doc.rect(MARGIN_LEFT, cursorY, CONTENT_WIDTH, 9, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    setTextColor(COLORS.BLANCO)
    doc.text('NETO A PAGAR', 24, cursorY + 6)
    cursorY += 9
    
    // Cuerpo centrado
    setFillColor(COLORS.AZUL_LIGHT)
    doc.rect(MARGIN_LEFT, cursorY, CONTENT_WIDTH, 22, 'F')
    
    // Texto "NETO A PAGAR"
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    setTextColor(COLORS.AZUL)
    doc.text('NETO A PAGAR', 107.95, cursorY + 8, { align: 'center' })
    
    // Valor grande
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(18)
    setTextColor(COLORS.AZUL)
    doc.text(formatCOPpdf(resultado.netoPagar), 107.95, cursorY + 18, { align: 'center' })
    
    cursorY += 22
    
    // Borde exterior neto
    setDrawColor(COLORS.AZUL)
    doc.setLineWidth(0.7)
    doc.rect(MARGIN_LEFT, netoStartY, CONTENT_WIDTH, 31, 'S')
    
    cursorY += 5
    
    // ===== SECCION 6: COSTO EMPRESA =====
    // Estimar altura de la seccion empresa
    let aportesCount = 3 // salud, pension, arl
    if (config.aplicarCaja) aportesCount++
    if (config.aplicarICBF) aportesCount++
    if (config.aplicarSENA) aportesCount++
    const empresaHeight = 9 + 7 + (aportesCount * ROW_H) + 7 + (4 * ROW_H) + 10
    checkPageBreak(empresaHeight)
    
    const empresaStartY = cursorY
    
    // Badge principal gris
    setFillColor(COLORS.GRIS)
    doc.rect(MARGIN_LEFT, cursorY, CONTENT_WIDTH, 9, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    setTextColor(COLORS.BLANCO)
    doc.text('COSTO EMPRESA (referencia empleador)', 24, cursorY + 6)
    cursorY += 9
    
    // Sub-badge Aportes
    setFillColor(COLORS.AMARILLO_L)
    doc.rect(MARGIN_LEFT, cursorY, CONTENT_WIDTH, 7, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7.5)
    setTextColor(COLORS.AMARILLO)
    doc.text('Aportes parafiscales y seguridad social', 24, cursorY + 5)
    cursorY += 7
    
    // Filas aportes
    const aportesFilas = [
      { concepto: 'Salud empleador (8.5%)', valor: formatCOPpdf(resultado.saludEmpleador) },
      { concepto: 'Pension empleador (12%)', valor: formatCOPpdf(resultado.pensionEmpleador) },
      { concepto: `ARL Nivel ${resultado.nivelArl} (${resultado.porcentajeArl}%)`, valor: formatCOPpdf(resultado.arl) }
    ]
    
    if (config.aplicarCaja) {
      aportesFilas.push({ concepto: 'Caja de Compensacion (4%)', valor: formatCOPpdf(resultado.caja) })
    }
    if (config.aplicarICBF) {
      aportesFilas.push({ concepto: 'ICBF (3%)', valor: formatCOPpdf(resultado.icbf) })
    }
    if (config.aplicarSENA) {
      aportesFilas.push({ concepto: 'SENA (2%)', valor: formatCOPpdf(resultado.sena) })
    }
    
    aportesFilas.forEach((fila, i) => {
      if (i % 2 === 1) {
        setFillColor(COLORS.ZEBRA)
        doc.rect(MARGIN_LEFT, cursorY, CONTENT_WIDTH, ROW_H, 'F')
      }
      
      setDrawColor(COLORS.GRIS_MED)
      doc.setLineWidth(0.3)
      doc.line(MARGIN_LEFT, cursorY + ROW_H, MARGIN_RIGHT, cursorY + ROW_H)
      
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(9)
      setTextColor(COLORS.TEXTO_OSCURO)  // Changed from SLATE_MED to TEXTO_OSCURO for better contrast
      doc.text(fila.concepto, 24, cursorY + 5.5)
      
      doc.setFont('helvetica', 'bold')
      setTextColor(COLORS.TEXTO_MEDIO)  // Changed from GRIS to TEXTO_MEDIO for better contrast
      doc.text(fila.valor, MARGIN_RIGHT, cursorY + 5.5, { align: 'right' })
      
      cursorY += ROW_H
    })
    
    // Sub-badge Prestaciones
    setFillColor(COLORS.PURPURA_L)
    doc.rect(MARGIN_LEFT, cursorY, CONTENT_WIDTH, 7, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7.5)
    setTextColor(COLORS.PURPURA)
    doc.text('Prestaciones sociales', 24, cursorY + 5)
    cursorY += 7
    
    // Filas prestaciones
    const prestacionesFilas = [
      { concepto: 'Cesantias (8.33%)', valor: formatCOPpdf(resultado.cesantias) },
      { concepto: 'Intereses sobre cesantias', valor: formatCOPpdf(resultado.interesesCesantias) },
      { concepto: 'Prima de servicios (8.33%)', valor: formatCOPpdf(resultado.prima) },
      { concepto: 'Vacaciones (4.17%)', valor: formatCOPpdf(resultado.vacaciones) }
    ]
    
    prestacionesFilas.forEach((fila, i) => {
      if (i % 2 === 1) {
        setFillColor(COLORS.ZEBRA)
        doc.rect(MARGIN_LEFT, cursorY, CONTENT_WIDTH, ROW_H, 'F')
      }
      
      setDrawColor(COLORS.GRIS_MED)
      doc.setLineWidth(0.3)
      doc.line(MARGIN_LEFT, cursorY + ROW_H, MARGIN_RIGHT, cursorY + ROW_H)
      
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(9)
      setTextColor(COLORS.TEXTO_OSCURO)  // Changed from SLATE_MED to TEXTO_OSCURO for better contrast
      doc.text(fila.concepto, 24, cursorY + 5.5)
      
      doc.setFont('helvetica', 'bold')
      setTextColor(COLORS.TEXTO_MEDIO)  // Changed from GRIS to TEXTO_MEDIO for better contrast
      doc.text(fila.valor, MARGIN_RIGHT, cursorY + 5.5, { align: 'right' })
      
      cursorY += ROW_H
    })
    
    // Fila gran total
    setFillColor(COLORS.SLATE_MED)  // Changed from GRIS to SLATE_MED for pastel theme
    doc.rect(MARGIN_LEFT, cursorY, CONTENT_WIDTH, 10, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    setTextColor(COLORS.BLANCO)
    doc.text('TOTAL COSTO EMPRESA', 24, cursorY + 6.5)
    doc.text(formatCOPpdf(resultado.costoTotalEmpresa), MARGIN_RIGHT, cursorY + 6.5, { align: 'right' })
    cursorY += 10
    
    // Borde exterior empresa
    const empresaTotalHeight = cursorY - empresaStartY
    setDrawColor(COLORS.GRIS)
    doc.setLineWidth(0.5)
    doc.rect(MARGIN_LEFT, empresaStartY, CONTENT_WIDTH, empresaTotalHeight, 'S')
    
    // ===== FOOTER =====
    drawFooter()
    
    // Guardar PDF
    doc.save(`ANTO_NOMINA_${inputs.nombre.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.pdf`)
  }, [resultado, inputs, config])
  
  return (
    <button
      className="btn w-100 mt-3 fw-bold"
      style={{ 
        backgroundColor: THEME.verde, 
        color: THEME.white,
        border: 'none',
        boxShadow: `0 0 15px ${THEME.verde}40`
      }}
      onClick={generarPDF}
      disabled={!resultado}
    >
      Generar Comprobante PDF
    </button>
  )
}

// --- APP PRINCIPAL ---
export default function AntoNomina() {
  const [inputs, setInputs] = useState<InputsNomina>(ESTADO_INICIAL)
  const [config, setConfig] = useState<ConfigNomina>(CONFIG_DEFAULT)
  const [resultado, setResultado] = useState<ResultadoNomina | null>(null)
  const [jsPDFLoaded, setJsPDFLoaded] = useState(false)
  
  const anioVigente = new Date().getFullYear()
  
  // Verificar que jsPDF está cargado
  useEffect(() => {
    const checkJsPDF = () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if ((window as any).jspdf) {
        setJsPDFLoaded(true)
      } else {
        setTimeout(checkJsPDF, 100)
      }
    }
    checkJsPDF()
  }, [])
  
  // Calcular en tiempo real cuando cambian los inputs o config
  const calcular = useCallback(() => {
    const res = calcularNomina(inputs, config)
    setResultado(res)
  }, [inputs, config])
  
  // Auto-calcular al cambiar inputs o config
  useEffect(() => {
    calcular()
  }, [calcular])
  
  // Cargar Bootstrap JS para el acordeón
  useEffect(() => {
    const script = document.createElement('script')
    script.src = 'https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js'
    script.async = true
    document.body.appendChild(script)
    
    return () => {
      document.body.removeChild(script)
    }
  }, [])
  
  return (
    <div style={{ backgroundColor: THEME.bg, minHeight: '100vh' }}>
      <Header anioVigente={anioVigente} />
      
      <div className="container pb-5">
        <div className="row">
          <div className="col-md-5 mb-4">
            <Formulario
              inputs={inputs}
              setInputs={setInputs}
              config={config}
              setConfig={setConfig}
              onCalcular={calcular}
            />
            
            {/* Logo Somas Group en espacio inferior izquierdo */}
            <div className="mt-4 text-center">
              <img 
                src="/images/somas-group-logo.png" 
                alt="Somas Group" 
                className="logo-neon"
                style={{ 
                  maxWidth: '180px', 
                  opacity: 0.9
                }}
              />
              <p className="mt-2 small" style={{ color: THEME.grayMed }}>
                Powered by Somas Group
              </p>
            </div>
          </div>
          
          <div className="col-md-7">
            {resultado && (
              <>
                <Resultados resultado={resultado} inputs={inputs} config={config} />
                {jsPDFLoaded && (
                  <BotonPDF resultado={resultado} inputs={inputs} config={config} />
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
