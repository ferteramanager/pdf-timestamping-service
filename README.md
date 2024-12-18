# 📚 Servicio de Sellado de Tiempo para PDF

Un servicio serverless para el sellado de tiempo de documentos PDF utilizando la blockchain de Bitcoin a través del protocolo OpenTimestamps. Este servicio permite registrar documentos de manera segura y verificar su existencia en un momento específico del tiempo.

⚠️ **ADVERTENCIA: PRUEBA DE CONCEPTO** ⚠️

Este proyecto es una Prueba de Concepto (POC) y requiere mejoras significativas de seguridad antes de su implementación en un entorno productivo, incluyendo pero no limitado a:

- Implementación de autenticación robusta
- Cifrado de datos en reposo y en tránsito
- Validación exhaustiva de entrada de datos
- Gestión segura de secretos
- Implementación de logs de auditoría
- Configuración de políticas de retención de datos
- Hardening de la configuración de AWS
- Implementación de WAF y otras medidas de seguridad perimetral

## 🌟 Características

- 📄 Carga y almacenamiento de documentos PDF
- ⛓️ Sellado de tiempo en blockchain usando OpenTimestamps
- ✅ Verificación de documentos y seguimiento de estado
- 🔍 Listado de documentos con capacidad de filtrado
- ⏱️ Verificación automática de sellos de tiempo pendientes
- 🔐 URLs presignadas seguras para acceso a documentos

## 🏗️ Arquitectura

El servicio está construido usando:
- AWS Lambda para funciones serverless
- Amazon S3 para almacenamiento de documentos
- DynamoDB para metadatos y gestión de estado
- API Gateway para endpoints RESTful
- OpenTimestamps para sellado de tiempo en blockchain

## 🚀 Comenzando

### Prerrequisitos

- Node.js 18.x
- AWS CLI configurado con credenciales apropiadas
- Serverless Framework CLI
- Una cuenta AWS con permisos adecuados

### Instalación

1. Clonar el repositorio:
```bash
git clone https://github.com/ferteramanager/pdf-timestamping-service.git
cd pdf-timestamping-service
```

2. Instalar dependencias:
```bash
npm install
```

3. Crear archivo `.env` con tu configuración:
```env
PDF_BUCKET=pdf-timestamping-v1-pdfs-dev
OTS_BUCKET=pdf-timestamping-v1-timestamps-dev
DYNAMODB_TABLE=pdf-timestamping-v1-documents-dev
```

4. Desplegar el servicio:
```bash
serverless deploy
```

## 🔧 Endpoints de la API

### Subida de Documentos
- **POST** `/upload`
- **Headers Requeridos:**
  - `x-filename`: Nombre del archivo PDF
  - `x-empresa`: Nombre de la empresa
  - `x-provincia`: Provincia
  - `x-emisiones-co2`: Emisiones de CO2
  - `x-consumo-energia`: Consumo de energía
  - `x-certificador-email`: Email del certificador
  - `x-certificador-name`: Nombre del certificador
  - `x-cuit-propietario`: CUIT del propietario (11 dígitos)
  - `x-nombre-propietario`: Nombre del propietario
  - `x-renspa`: Número RENSPA (formato: XX.XXX.X.XXXXX/XX)
  - `x-periodo-certificado`: Período de certificación
  - `x-resultado-certificacion`: Resultado de la certificación

### Validar Documento
- **GET** `/validate/{code}`
- Retorna el estado del documento y detalles de verificación

### Listar Documentos
- **GET** `/list`
- **Parámetros de consulta:**
  - `empresa`: Filtrar por empresa
  - `provincia`: Filtrar por provincia
  - `startDate`: Filtrar por fecha inicial
  - `endDate`: Filtrar por fecha final

## ⚙️ Tareas en Segundo Plano

El servicio incluye una función programada (`checkPendingDocuments`) que se ejecuta cada 30 minutos para verificar el estado de los sellos de tiempo pendientes en la blockchain de Bitcoin.

## 💾 Estructura de Datos

### Esquema DynamoDB
```javascript
{
  code: String,            // Clave Primaria
  documentHash: String,    // Hash SHA256 del documento
  filename: String,        // Nombre original del archivo
  empresa: String,         // Nombre de la empresa
  provincia: String,       // Provincia
  emisionesCO2: Number,   // Emisiones de CO2
  consumoEnergia: Number, // Consumo de energía
  status: String,         // STAMPING o CONFIRMED
  timeline: {
    uploadedAt: String,
    stampingStartedAt: String,
    confirmedAt: String,
    lastVerificationAt: String
  },
  certificador: {
    email: String,
    name: String,
    timestamp: String
  },
  propietario: {
    cuit: String,
    nombre: String,
    renspa: String
  },
  certificacion: {
    periodo: String,
    resultado: String,
    fechaRegistro: String
  },
  s3Path: String          // Ruta en el bucket S3
}
```

## 🔒 Seguridad

- Endpoints de API protegidos con claves de API
- Documentos almacenados en buckets S3 privados
- Acceso a documentos gestionado mediante URLs presignadas
- CORS configurado para solicitudes cross-origin seguras

## 📝 Límites de Uso

- Límite de tasa de API: 10 solicitudes por segundo
- Límite de ráfaga: 20 solicitudes
- Cuota mensual: 1000 solicitudes

## 🤝 Contribuir

1. Haz un fork del repositorio
2. Crea tu rama de funcionalidad (`git checkout -b feature/NuevaFuncionalidad`)
3. Realiza tus cambios (`git commit -m 'Agrega nueva funcionalidad'`)
4. Sube los cambios (`git push origin feature/NuevaFuncionalidad`)
5. Abre un Pull Request

## 📄 Licencia

Este proyecto está licenciado bajo la Licencia MIT - ver el archivo LICENSE para más detalles.