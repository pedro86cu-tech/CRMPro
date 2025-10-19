import { useState } from 'react';
import { Plus, Trash2, ArrowRight } from 'lucide-react';

interface FieldMapping {
  targetField: string;
  sourceField: string;
}

interface FieldMapperProps {
  title: string;
  mappings: Record<string, string>;
  onChange: (mappings: Record<string, string>) => void;
  availableFields: { value: string; label: string; description?: string }[];
  placeholder?: string;
  isResponse?: boolean;
}

export function FieldMapper({
  title,
  mappings,
  onChange,
  availableFields,
  placeholder = 'Seleccione un campo',
  isResponse = false
}: FieldMapperProps) {
  const [fieldMappings, setFieldMappings] = useState<FieldMapping[]>(() => {
    return Object.entries(mappings).map(([key, value]) => ({
      targetField: key,
      sourceField: value
    }));
  });

  const updateMappings = (newMappings: FieldMapping[]) => {
    setFieldMappings(newMappings);
    const mappingObject = newMappings.reduce((acc, mapping) => {
      if (mapping.targetField && mapping.sourceField) {
        acc[mapping.targetField] = mapping.sourceField;
      }
      return acc;
    }, {} as Record<string, string>);
    onChange(mappingObject);
  };

  const addMapping = () => {
    updateMappings([...fieldMappings, { targetField: '', sourceField: '' }]);
  };

  const removeMapping = (index: number) => {
    updateMappings(fieldMappings.filter((_, i) => i !== index));
  };

  const updateMapping = (index: number, field: 'targetField' | 'sourceField', value: string) => {
    const newMappings = [...fieldMappings];
    newMappings[index][field] = value;
    updateMappings(newMappings);
  };

  const getFieldDescription = (value: string) => {
    const field = availableFields.find(f => f.value === value);
    return field?.description;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium text-slate-700">{title}</h3>
          <p className="text-xs text-slate-500 mt-1">
            {isResponse
              ? 'Mapee los campos de la respuesta de la API a los campos locales'
              : 'Mapee los campos locales a los campos que espera la API externa'}
          </p>
        </div>
        <button
          type="button"
          onClick={addMapping}
          className="flex items-center space-x-1 text-teal-600 hover:text-teal-700 text-sm"
        >
          <Plus size={16} />
          <span>Agregar Campo</span>
        </button>
      </div>

      {fieldMappings.length === 0 && (
        <div className="text-center py-8 bg-slate-50 rounded-lg border-2 border-dashed border-slate-200">
          <p className="text-sm text-slate-500">No hay campos mapeados</p>
          <p className="text-xs text-slate-400 mt-1">Click en "Agregar Campo" para comenzar</p>
        </div>
      )}

      <div className="space-y-3">
        {fieldMappings.map((mapping, index) => (
          <div key={index} className="bg-slate-50 rounded-lg p-4 border border-slate-200">
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  {isResponse ? 'Campo API (Response)' : 'Campo API Externa'}
                </label>
                <input
                  type="text"
                  value={mapping.targetField}
                  onChange={(e) => updateMapping(index, 'targetField', e.target.value)}
                  className="w-full border border-slate-300 rounded px-3 py-2 text-sm"
                  placeholder={isResponse ? 'response.campo' : 'nombre_campo_api'}
                />
              </div>

              <div className="pt-6">
                <ArrowRight className={isResponse ? 'rotate-180' : ''} size={20} />
              </div>

              <div className="flex-1">
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  {isResponse ? 'Campo Local' : 'Campo Sistema (Invoice)'}
                </label>
                <select
                  value={mapping.sourceField}
                  onChange={(e) => updateMapping(index, 'sourceField', e.target.value)}
                  className="w-full border border-slate-300 rounded px-3 py-2 text-sm"
                >
                  <option value="">{placeholder}</option>
                  {availableFields.map((field) => (
                    <option key={field.value} value={field.value}>
                      {field.label}
                    </option>
                  ))}
                </select>
                {mapping.sourceField && getFieldDescription(mapping.sourceField) && (
                  <p className="text-xs text-slate-500 mt-1">
                    {getFieldDescription(mapping.sourceField)}
                  </p>
                )}
              </div>

              <button
                type="button"
                onClick={() => removeMapping(index)}
                className="text-red-600 hover:text-red-700 mt-6"
              >
                <Trash2 size={18} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
