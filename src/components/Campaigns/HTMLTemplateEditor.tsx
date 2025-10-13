import { useState, useEffect } from 'react';
import { Code, Eye, Save, X, Plus, Upload, Image as ImageIcon, Link as LinkIcon, Smartphone, QrCode, Sparkles } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../contexts/ToastContext';

interface Variable {
  key: string;
  name: string;
  example: string;
}

interface HTMLTemplateEditorProps {
  template?: any;
  onSave: () => void;
  onClose: () => void;
}

export function HTMLTemplateEditor({ template, onSave, onClose }: HTMLTemplateEditorProps) {
  const toast = useToast();
  const [name, setName] = useState(template?.name || '');
  const [subject, setSubject] = useState(template?.subject || '');
  const [htmlBody, setHtmlBody] = useState(template?.html_body || getDefaultTemplate());
  const [showPreview, setShowPreview] = useState(false);
  const [availableVariables, setAvailableVariables] = useState<Variable[]>([]);
  const [previewData, setPreviewData] = useState<Record<string, string>>({});
  const [showImageUpload, setShowImageUpload] = useState(false);
  const [showQRGenerator, setShowQRGenerator] = useState(false);
  const [showAppStoreButtons, setShowAppStoreButtons] = useState(false);

  const [imageUrl, setImageUrl] = useState('');
  const [qrData, setQrData] = useState('');
  const [appStoreLink, setAppStoreLink] = useState('');
  const [playStoreLink, setPlayStoreLink] = useState('');

  useEffect(() => {
    loadVariables();
    if (template?.preview_data) {
      setPreviewData(template.preview_data);
    }
  }, [template]);

  const loadVariables = async () => {
    const { data } = await supabase
      .from('template_variables')
      .select('*')
      .order('name');

    if (data) {
      setAvailableVariables(data);
      const initialPreview: Record<string, string> = {};
      data.forEach(v => {
        initialPreview[v.key] = v.example || v.default_value || '';
      });
      if (!template?.preview_data) {
        setPreviewData(initialPreview);
      }
    }
  };

  const insertVariable = (key: string) => {
    const variableTag = `{{${key}}}`;
    setHtmlBody(prev => prev + ' ' + variableTag + ' ');
  };

  const insertImage = () => {
    if (!imageUrl) return;
    const imageHtml = `
    <div style="text-align: center; margin: 20px 0;">
      <img src="${imageUrl}" alt="Logo" style="max-width: 200px; height: auto;" />
    </div>`;
    setHtmlBody(prev => prev + imageHtml);
    setImageUrl('');
    setShowImageUpload(false);
  };

  const insertQRCode = () => {
    if (!qrData) return;
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrData)}`;
    const qrHtml = `
    <div style="text-align: center; margin: 30px 0;">
      <p style="font-size: 18px; color: #333333; margin-bottom: 15px;">Escanea para descargar</p>
      <img src="${qrUrl}" alt="QR Code" style="width: 200px; height: 200px; border: 2px solid #333333; border-radius: 10px;" />
    </div>`;
    setHtmlBody(prev => prev + qrHtml);
    setQrData('');
    setShowQRGenerator(false);
  };

  const insertAppStoreButtons = () => {
    let buttonsHtml = `
    <div style="text-align: center; margin: 30px 0;">
      <p style="font-size: 20px; color: #333333; font-weight: bold; margin-bottom: 20px;">Descarga nuestra App</p>
      <div style="display: inline-flex; gap: 15px; flex-wrap: wrap; justify-content: center;">`;

    if (appStoreLink) {
      buttonsHtml += `
        <a href="${appStoreLink}" style="text-decoration: none;">
          <img src="https://developer.apple.com/assets/elements/badges/download-on-the-app-store.svg" alt="App Store" style="height: 50px;" />
        </a>`;
    }

    if (playStoreLink) {
      buttonsHtml += `
        <a href="${playStoreLink}" style="text-decoration: none;">
          <img src="https://play.google.com/intl/en_us/badges/static/images/badges/en_badge_web_generic.png" alt="Google Play" style="height: 70px;" />
        </a>`;
    }

    buttonsHtml += `
      </div>
    </div>`;

    setHtmlBody(prev => prev + buttonsHtml);
    setAppStoreLink('');
    setPlayStoreLink('');
    setShowAppStoreButtons(false);
  };

  const insertCustomLink = () => {
    const linkHtml = `
    <div style="text-align: center; margin: 30px 0;">
      <a href="URL_AQUI" style="display: inline-block; padding: 15px 40px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-decoration: none; border-radius: 50px; font-size: 18px; font-weight: bold; box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);">
        Descargar Ahora
      </a>
    </div>`;
    setHtmlBody(prev => prev + linkHtml);
  };

  const renderPreview = () => {
    let rendered = htmlBody;
    Object.keys(previewData).forEach(key => {
      const regex = new RegExp(`{{${key}}}`, 'g');
      rendered = rendered.replace(regex, previewData[key] || `{{${key}}}`);
    });
    return rendered;
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error('Por favor ingresa un nombre para la plantilla');
      return;
    }

    if (!subject.trim()) {
      toast.error('Por favor ingresa un asunto para el email');
      return;
    }

    try {
      const userId = (await supabase.auth.getUser()).data.user?.id;

      const templateData: any = {
        name,
        subject,
        html_body: htmlBody,
        body: htmlBody.replace(/<[^>]*>/g, '').substring(0, 200),
        variables: availableVariables.map(v => v.key),
        preview_data: previewData
      };

      if (userId) {
        templateData.created_by = userId;
      }

      if (template) {
        const { error } = await supabase
          .from('email_templates')
          .update(templateData)
          .eq('id', template.id);

        if (error) {
          toast.error(`Error al actualizar: ${error.message}`);
          return;
        }

        toast.success('Plantilla actualizada correctamente');
      } else {
        const { error } = await supabase
          .from('email_templates')
          .insert(templateData);

        if (error) {
          toast.error(`Error al crear: ${error.message}`);
          return;
        }

        toast.success('Plantilla creada correctamente');
      }

      onSave();
    } catch (err) {
      toast.error('Error inesperado al guardar la plantilla');
    }
  };

  const loadTemplatePreset = (type: 'product-launch' | 'newsletter' | 'app-launch') => {
    if (type === 'app-launch') {
      setName('Lanzamiento de App Móvil');
      setSubject('¡Descarga nuestra nueva App! 🚀');
      setHtmlBody(`
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f7fa;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f4f7fa;">
    <tr>
      <td align="center" style="padding: 40px 0;">
        <table width="600" cellpadding="0" cellspacing="0" border="0" style="background-color: #ffffff; border-radius: 20px; box-shadow: 0 10px 30px rgba(0,0,0,0.1);">

          <!-- Header con Logo -->
          <tr>
            <td style="padding: 40px 40px 0; text-align: center;">
              <!-- COLOCA TU LOGO AQUÍ -->
              <h1 style="margin: 0; color: #333333; font-size: 32px;">{{crm_company}}</h1>
            </td>
          </tr>

          <!-- Título Principal -->
          <tr>
            <td style="padding: 30px 40px; text-align: center;">
              <h2 style="margin: 0; color: #667eea; font-size: 28px; font-weight: bold;">¡Hola {{client_name}}! 👋</h2>
              <p style="margin: 20px 0 0; color: #666666; font-size: 18px; line-height: 1.6;">
                Tenemos grandes noticias para ti
              </p>
            </td>
          </tr>

          <!-- Contenido Principal -->
          <tr>
            <td style="padding: 0 40px 30px;">
              <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px; border-radius: 15px; color: white; text-align: center;">
                <h3 style="margin: 0 0 15px; font-size: 24px;">🚀 Nuestra App Ya Está Disponible</h3>
                <p style="margin: 0; font-size: 16px; line-height: 1.6; opacity: 0.95;">
                  Descarga ahora y disfruta de todas las funcionalidades desde tu dispositivo móvil
                </p>
              </div>
            </td>
          </tr>

          <!-- QR Code Section -->
          <tr>
            <td style="padding: 0 40px 30px; text-align: center;">
              <p style="margin: 0 0 20px; color: #333333; font-size: 18px; font-weight: bold;">Escanea para descargar</p>
              <!-- INSERTA AQUÍ TU CÓDIGO QR -->
            </td>
          </tr>

          <!-- App Store Buttons -->
          <tr>
            <td style="padding: 0 40px 40px; text-align: center;">
              <p style="margin: 0 0 20px; color: #333333; font-size: 16px;">O descarga desde:</p>
              <!-- INSERTA AQUÍ LOS BOTONES DE APP STORE Y PLAY STORE -->
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 30px 40px; background-color: #f8f9fa; border-radius: 0 0 20px 20px; text-align: center;">
              <p style="margin: 0; color: #999999; font-size: 14px;">
                Gracias por confiar en nosotros<br>
                {{crm_company}} - {{current_date}}
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
      `);
    } else if (type === 'product-launch') {
      setName('Lanzamiento de Producto');
      setSubject('¡Nuevo producto disponible! 🎉');
      setHtmlBody(getProductLaunchTemplate());
    } else if (type === 'newsletter') {
      setName('Newsletter');
      setSubject('Boletín mensual de {{crm_company}}');
      setHtmlBody(getNewsletterTemplate());
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-7xl h-[90vh] flex flex-col shadow-2xl">
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-6 rounded-t-2xl">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-white">
                {template ? 'Editar Plantilla HTML' : 'Nueva Plantilla HTML'}
              </h2>
              <p className="text-blue-100 text-sm mt-1">Crea plantillas profesionales con variables dinámicas</p>
            </div>
            <button onClick={onClose} className="text-white hover:bg-white/20 p-2 rounded-lg transition">
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-hidden flex">
          <div className="w-80 bg-slate-50 border-r border-slate-200 p-6 overflow-y-auto">
            <div className="mb-6">
              <h3 className="text-lg font-bold text-slate-900 mb-3 flex items-center">
                <Sparkles className="w-5 h-5 mr-2 text-purple-600" />
                Plantillas Rápidas
              </h3>
              <div className="space-y-2">
                <button
                  onClick={() => loadTemplatePreset('app-launch')}
                  className="w-full text-left p-3 bg-white rounded-lg hover:bg-purple-50 border border-slate-200 transition"
                >
                  <div className="flex items-center space-x-2">
                    <Smartphone className="w-5 h-5 text-purple-600" />
                    <div>
                      <p className="font-medium text-slate-900">Lanzamiento App</p>
                      <p className="text-xs text-slate-500">Con QR y botones store</p>
                    </div>
                  </div>
                </button>
                <button
                  onClick={() => loadTemplatePreset('product-launch')}
                  className="w-full text-left p-3 bg-white rounded-lg hover:bg-blue-50 border border-slate-200 transition"
                >
                  <div className="flex items-center space-x-2">
                    <Sparkles className="w-5 h-5 text-blue-600" />
                    <div>
                      <p className="font-medium text-slate-900">Producto Nuevo</p>
                      <p className="text-xs text-slate-500">Anuncia lanzamientos</p>
                    </div>
                  </div>
                </button>
              </div>
            </div>

            <div className="mb-6">
              <h3 className="text-sm font-bold text-slate-700 mb-3">Variables Disponibles</h3>
              <p className="text-xs text-slate-500 mb-3">Click para insertar en la plantilla</p>
              <div className="space-y-2">
                {availableVariables.map((variable) => (
                  <button
                    key={variable.key}
                    onClick={() => insertVariable(variable.key)}
                    className="w-full text-left p-3 bg-white rounded-lg hover:bg-blue-50 border border-slate-200 transition group"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-mono text-sm text-blue-600">{`{{${variable.key}}}`}</p>
                        <p className="text-xs text-slate-500 mt-1">{variable.name}</p>
                      </div>
                      <Plus className="w-4 h-4 text-slate-400 group-hover:text-blue-600" />
                    </div>
                    <div className="mt-2 p-2 bg-slate-50 rounded text-xs text-slate-600">
                      Ej: {variable.example}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <h3 className="text-sm font-bold text-slate-700 mb-3">Elementos Especiales</h3>
              <div className="space-y-2">
                <button
                  onClick={() => setShowImageUpload(true)}
                  className="w-full flex items-center space-x-2 p-3 bg-green-50 text-green-700 rounded-lg hover:bg-green-100 transition border border-green-200"
                >
                  <ImageIcon className="w-4 h-4" />
                  <span className="text-sm font-medium">Insertar Logo/Imagen</span>
                </button>

                <button
                  onClick={() => setShowQRGenerator(true)}
                  className="w-full flex items-center space-x-2 p-3 bg-purple-50 text-purple-700 rounded-lg hover:bg-purple-100 transition border border-purple-200"
                >
                  <QrCode className="w-4 h-4" />
                  <span className="text-sm font-medium">Generar Código QR</span>
                </button>

                <button
                  onClick={() => setShowAppStoreButtons(true)}
                  className="w-full flex items-center space-x-2 p-3 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition border border-blue-200"
                >
                  <Smartphone className="w-4 h-4" />
                  <span className="text-sm font-medium">Botones App Store</span>
                </button>

                <button
                  onClick={insertCustomLink}
                  className="w-full flex items-center space-x-2 p-3 bg-orange-50 text-orange-700 rounded-lg hover:bg-orange-100 transition border border-orange-200"
                >
                  <LinkIcon className="w-4 h-4" />
                  <span className="text-sm font-medium">Botón Personalizado</span>
                </button>
              </div>
            </div>
          </div>

          <div className="flex-1 flex flex-col">
            <div className="p-6 border-b border-slate-200 bg-white">
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Nombre de la Plantilla</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Ej: Bienvenida a nuevos clientes"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Asunto del Email</label>
                  <input
                    type="text"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Ej: Bienvenido {{client_name}} a {{crm_company}}"
                  />
                </div>
              </div>

              <div className="flex space-x-2">
                <button
                  onClick={() => setShowPreview(false)}
                  className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition ${
                    !showPreview
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  <Code className="w-4 h-4" />
                  <span>Código HTML</span>
                </button>
                <button
                  onClick={() => setShowPreview(true)}
                  className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition ${
                    showPreview
                      ? 'bg-purple-600 text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  <Eye className="w-4 h-4" />
                  <span>Vista Previa</span>
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-hidden bg-slate-50 p-6">
              {!showPreview ? (
                <textarea
                  value={htmlBody}
                  onChange={(e) => setHtmlBody(e.target.value)}
                  className="w-full h-full p-4 font-mono text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                  placeholder="Escribe tu código HTML aquí..."
                />
              ) : (
                <div className="w-full h-full overflow-auto bg-white border border-slate-300 rounded-lg">
                  <iframe
                    srcDoc={renderPreview()}
                    className="w-full h-full"
                    title="Preview"
                    sandbox="allow-same-origin allow-popups"
                  />
                </div>
              )}
            </div>

            <div className="p-6 border-t border-slate-200 bg-white flex justify-end space-x-3">
              <button
                onClick={onClose}
                className="px-6 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition"
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                className="flex items-center space-x-2 px-6 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:from-blue-700 hover:to-purple-700 transition shadow-lg"
              >
                <Save className="w-5 h-5" />
                <span>Guardar Plantilla</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {showImageUpload && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-md w-full">
            <h3 className="text-xl font-bold text-slate-900 mb-4">Insertar Imagen/Logo</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">URL de la Imagen</label>
                <input
                  type="url"
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500"
                  placeholder="https://ejemplo.com/logo.png"
                />
                <p className="text-xs text-slate-500 mt-1">Puedes usar servicios como Imgur, Cloudinary o tu servidor</p>
              </div>
              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => { setShowImageUpload(false); setImageUrl(''); }}
                  className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={insertImage}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                >
                  Insertar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showQRGenerator && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-md w-full">
            <h3 className="text-xl font-bold text-slate-900 mb-4">Generar Código QR</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">URL o Texto</label>
                <input
                  type="text"
                  value={qrData}
                  onChange={(e) => setQrData(e.target.value)}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                  placeholder="https://play.google.com/store/apps/details?id=tu.app"
                />
                <p className="text-xs text-slate-500 mt-1">El QR se generará automáticamente con este contenido</p>
              </div>
              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => { setShowQRGenerator(false); setQrData(''); }}
                  className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={insertQRCode}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
                >
                  Insertar QR
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showAppStoreButtons && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-md w-full">
            <h3 className="text-xl font-bold text-slate-900 mb-4">Botones de Descarga</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Link App Store (iOS)</label>
                <input
                  type="url"
                  value={appStoreLink}
                  onChange={(e) => setAppStoreLink(e.target.value)}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="https://apps.apple.com/..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Link Play Store (Android)</label>
                <input
                  type="url"
                  value={playStoreLink}
                  onChange={(e) => setPlayStoreLink(e.target.value)}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="https://play.google.com/store/apps/..."
                />
              </div>
              <p className="text-xs text-slate-500">Puedes agregar uno o ambos links</p>
              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => { setShowAppStoreButtons(false); setAppStoreLink(''); setPlayStoreLink(''); }}
                  className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={insertAppStoreButtons}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Insertar Botones
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function getDefaultTemplate() {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f4f4f4;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0">
    <tr>
      <td align="center" style="padding: 40px 0;">
        <table width="600" cellpadding="0" cellspacing="0" border="0" style="background-color: #ffffff; border-radius: 8px;">
          <tr>
            <td style="padding: 40px 30px;">
              <h2 style="margin: 0 0 20px; color: #333333;">Hola {{client_name}},</h2>
              <p style="margin: 0 0 15px; color: #666666; font-size: 16px; line-height: 1.6;">
                Gracias por confiar en nosotros. En <strong>{{company_name}}</strong> estamos comprometidos con brindarte el mejor servicio.
              </p>
              <p style="margin: 0; color: #666666; font-size: 16px; line-height: 1.6;">
                Si tienes alguna pregunta, no dudes en contactarnos.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding: 30px; background-color: #f8f8f8; text-align: center; border-radius: 0 0 8px 8px;">
              <p style="margin: 0; color: #999999; font-size: 14px;">
                {{crm_company}} - {{current_date}}
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function getProductLaunchTemplate() {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f0f2f5;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0">
    <tr>
      <td align="center" style="padding: 40px 0;">
        <table width="600" cellpadding="0" cellspacing="0" border="0" style="background-color: #ffffff; border-radius: 15px; box-shadow: 0 5px 20px rgba(0,0,0,0.1);">
          <tr>
            <td style="padding: 40px 30px; text-align: center;">
              <h1 style="margin: 0; color: #2563eb; font-size: 32px;">¡Novedad Exclusiva!</h1>
            </td>
          </tr>
          <tr>
            <td style="padding: 0 30px 30px;">
              <h2 style="margin: 0 0 20px; color: #333333;">Hola {{client_name}},</h2>
              <p style="margin: 0 0 20px; color: #666666; font-size: 16px; line-height: 1.8;">
                Nos complace presentarte nuestro nuevo producto diseñado especialmente para ti.
              </p>
              <div style="text-align: center; margin: 30px 0;">
                <a href="#" style="display: inline-block; padding: 15px 40px; background-color: #2563eb; color: white; text-decoration: none; border-radius: 50px; font-size: 18px; font-weight: bold;">
                  Ver Ahora
                </a>
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function getNewsletterTemplate() {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif;">
  <h2>Hola {{client_name}}</h2>
  <p>Este es tu boletín mensual de {{crm_company}}</p>
</body>
</html>`;
}
