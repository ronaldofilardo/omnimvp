'use client'
import React, { useState, useEffect, useMemo, useRef } from 'react'
import { Eye, Trash2, UploadCloud, Info, Search } from 'lucide-react'
import { Input } from './ui/input'
import { format, toZonedTime } from 'date-fns-tz'
import { ptBR } from 'date-fns/locale/pt-BR'
import { FileSlotRepository } from './FileSlotRepository'

// Tipos de dados
interface FileInfo {
  slot: string
  name: string
  url?: string
  uploadDate?: string
  expiryDate?: string
}

interface Professional {
  id: string
  name: string
  specialty: string
}
interface EventWithFiles {
  id: string
  title: string
  date: string
  startTime: string
  endTime: string
  files: FileInfo[]
  professional: Professional
}

// Componente para um único slot de arquivo
interface FileSlotProps {
  label: string;
  file?: FileInfo;
  eventId?: string;
  onUpload: (file: File) => void;
  onView: () => void;
  onDelete: () => void;
  formatFileDate: (dateString: string) => string;
}

function FileSlot({ label, file, eventId, onUpload, onView, onDelete, formatFileDate }: FileSlotProps) {
  const hasFile = !!file
  const inputRef = useRef<HTMLInputElement>(null)

  const handleIconClick = () => {
    if (inputRef.current) inputRef.current.click()
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      onUpload(e.target.files[0])
      e.target.value = '' // permite novo upload do mesmo arquivo
    }
  }

  return (
    <div
      className={`grow flex items-center justify-between p-3 rounded-lg border ${hasFile ? 'bg-emerald-50 border-emerald-200' : 'bg-gray-50 border-gray-200'}`}
    >
      <div className="flex items-center gap-2 overflow-hidden">
        <span
          className={`font-medium ${hasFile ? 'text-emerald-800' : 'text-gray-500'}`}
        >
          {label}
        </span>
        {hasFile && (
          <div className="flex flex-col">
            <span className="text-sm text-emerald-700 truncate">
              ({file.name})
            </span>
            {file.uploadDate && (
              <span className="text-xs text-emerald-600">
                Upload: {formatFileDate(file.uploadDate)}
              </span>
            )}
            {file.expiryDate && (
              <span className="text-xs text-emerald-600">
                Validade: {formatFileDate(file.expiryDate)}
              </span>
            )}
          </div>
        )}
      </div>
      <div className="flex items-center gap-2">
        {hasFile ? (
          <>
            <button
              onClick={onView}
              className="text-gray-500 hover:text-blue-600"
              title="Visualizar"
            >
              <Eye size={16} />
            </button>
            <button
              onClick={async () => {
                if (!file || !eventId) return;
                if (!window.confirm(`Deseja realmente deletar o arquivo '${file.name}'?`)) return;
                try {
                  const res = await fetch(`/api/events/${eventId}`);
                  if (!res.ok) throw new Error('Falha ao buscar evento');
                  const event = await res.json();

                  const updatedFiles = event.files.filter((f: FileInfo) => f.slot !== file.slot);
                  const updateRes = await fetch(`/api/events/${eventId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      files: updatedFiles
                    })
                  });

                  if (!updateRes.ok) {
                    const errorData = await updateRes.json();
                    throw new Error(errorData.error || 'Falha ao atualizar evento');
                  }
                  onDelete();
                } catch (err) {
                  console.error('Erro ao deletar arquivo:', err);
                  alert(`Erro ao deletar arquivo: ${err instanceof Error ? err.message : 'Erro desconhecido'}. Por favor, tente novamente.`);
                }
              }}
              className="text-gray-500 hover:text-red-600"
              title="Deletar"
            >
              <Trash2 size={16} />
            </button>
          </>
        ) : (
          <>
            <button
              onClick={handleIconClick}
              className="text-gray-400 hover:text-blue-600"
              title="Upload"
              type="button"
            >
              <UploadCloud size={16} />
            </button>
            <input
              ref={inputRef}
              type="file"
              style={{ display: 'none' }}
              onChange={handleFileChange}
              accept="*"
            />
          </>
        )}
      </div>
    </div>
  )
}

interface RepositoryTabProps {
  userId: string
}

export function RepositoryTab({ userId }: RepositoryTabProps) {
  console.log('[RepositoryTab] Componente montado com userId:', userId)
  console.log('[RepositoryTab] Props recebidas:', { userId })

  const [events, setEvents] = useState<EventWithFiles[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [currentDateStr, setCurrentDateStr] = useState('')
  useEffect(() => {
    setCurrentDateStr(format(new Date(), 'dd/MM/yyyy - EEEE', { locale: ptBR }))
  }, [])

  useEffect(() => {
    async function fetchData() {
      try {
        console.log('[RepositoryTab] Iniciando fetch para userId:', userId)
        setLoading(true)
        const response = await fetch(`/api/repository?userId=${encodeURIComponent(userId)}`)
        console.log('[RepositoryTab] Response status:', response.status)
          if (!response.ok) {
            const error = new Error('Falha ao buscar dados')
            console.error('[RepositoryTab] Erro ao carregar repositório:', error)
            throw error
          }
        const data = await response.json()
        console.log('[RepositoryTab] Dados recebidos:', data)
        console.log('[RepositoryTab] Número de eventos:', data.length)
        setEvents(Array.isArray(data) ? data : [])
      } catch (error) {
        console.error('[RepositoryTab] Erro ao carregar repositório:', error)
        setEvents([])
      } finally {
        setLoading(false)
      }
    }
    if (userId) {
      fetchData()
    } else {
      console.warn('[RepositoryTab] userId não fornecido')
      setLoading(false)
    }
  }, [userId])

  const filteredEvents = useMemo(() => {
    if (!searchTerm.trim()) return events
    const lowerCaseSearchTerm = searchTerm.toLowerCase()
    return events.filter(
      (event) =>
        event.title.toLowerCase().includes(lowerCaseSearchTerm) ||
        event.professional.name.toLowerCase().includes(lowerCaseSearchTerm) ||
        event.files.some((file) =>
          file.name.toLowerCase().includes(lowerCaseSearchTerm)
        )
    )
  }, [events, searchTerm])

  const groupedEvents = useMemo(() => {
    const grouped = filteredEvents.reduce(
      (acc, event) => {
        const dateKey = event.date.split('T')[0]
        if (!acc[dateKey]) acc[dateKey] = []
        acc[dateKey].push(event)
        return acc
      },
      {} as Record<string, EventWithFiles[]>
    )
    return Object.entries(grouped).sort((a, b) => b[0].localeCompare(a[0]))
  }, [filteredEvents])

  const fileSummary = useMemo(() => {
    const counts: Record<string, number> = {}
    let total = 0
    events.forEach((event) => {
      event.files.forEach((file) => {
        total++
        const type = file.slot.charAt(0).toUpperCase() + file.slot.slice(1)
        counts[type] = (counts[type] || 0) + 1
      })
    })
    const summaryString = Object.entries(counts)
      .map(([type, count]) => `${count} ${type}(s)`)
      .join(' • ')
    return `Total: ${total} documento(s) (${summaryString})`
  }, [events])

  const formatDate = (dateString: string) => {
    const userTZ = Intl.DateTimeFormat().resolvedOptions().timeZone
    const date = toZonedTime(new Date(dateString + 'T12:00:00'), userTZ)
    return format(date, 'dd/MM/yyyy - EEEE', { locale: ptBR })
  }

  console.log('[RepositoryTab] Renderizando - Estado:', {
    userId,
    loading,
    eventsCount: events.length,
    filteredEventsCount: filteredEvents.length,
    searchTerm
  })

  return (
    <div className="flex-1 p-8 overflow-y-auto bg-gray-50" data-testid="repository-tab">
      <header className="mb-8">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-3xl font-bold text-gray-800">
            Repositório de Arquivos
          </h1>
          <span className="text-gray-500">
            {currentDateStr}
          </span>
        </div>
        <div className="flex justify-between items-center gap-4">
          <div className="grow bg-blue-50 border-l-4 border-blue-400 text-blue-800 p-4 rounded-r-lg flex items-center gap-3">
            <Info size={20} className="text-blue-500" />
            <p className="font-medium">{fileSummary}</p>
          </div>
          <div className="relative w-72">
            <Search
              size={18}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"
            />
            <Input
              placeholder="Buscar por evento, profissional ou arquivo..."
              className="pl-10 h-11"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
      </header>

      <main>
        {loading ? (
          <p className="text-center text-gray-500 mt-10">
            Carregando repositório...
          </p>
        ) : groupedEvents.length === 0 ? (
          <p className="text-center text-gray-500 mt-10">
            {searchTerm
              ? 'Nenhum resultado encontrado para sua busca.'
              : 'Nenhum arquivo encontrado no seu repositório.'}
          </p>
        ) : (
          <div className="space-y-8">
            {groupedEvents.map(([date, dayEvents]) => (
              <div key={date}>
                <h2 className="text-xl font-semibold text-gray-700 mb-4 pb-2 border-b">
                  {formatDate(date)}
                </h2>
                <div className="space-y-6">
                  {dayEvents.map((event) => (
                    <div
                      key={event.id}
                      className="bg-white border border-gray-200 rounded-xl shadow-sm p-6"
                    >
                      <h3 className="font-bold text-lg text-gray-800 mb-4">
                        {event.title} - {event.professional.name} - {event.startTime} - {event.endTime}
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {['request','authorization','certificate','result','prescription','invoice'].map((slotType) => {
                          const file = event.files?.find((f) => f.slot === slotType)
                          const labels: Record<string, string> = {
                            request: 'Solicitação',
                            authorization: 'Autorização',
                            certificate: 'Atestado',
                            result: 'Laudo/Resultado',
                            prescription: 'Prescrição',
                            invoice: 'Nota Fiscal',
                          }
                          const hasFile = !!file
                          // Função de upload real
                          const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
                            if (e.target.files && e.target.files[0]) {
                              try {
                                const formData = new FormData()
                                formData.append('file', e.target.files[0])
                                const res = await fetch('/api/upload', {
                                  method: 'POST',
                                  body: formData,
                                })
                                if (!res.ok) throw new Error('Falha no upload')
                                const data = await res.json()
                                // Atualiza lista de arquivos após upload
                                setEvents((prev) => prev.map(ev =>
                                  ev.id === event.id
                                    ? {
                                        ...ev,
                                        files: [
                                          ...ev.files.filter(f => f.slot !== slotType),
                                          {
                                            slot: slotType,
                                            name: data.name,
                                            url: data.url,
                                            uploadDate: data.uploadDate,
                                          },
                                        ],
                                      }
                                    : ev
                                ))
                              } catch (err) {
                                alert('Erro ao fazer upload: ' + (err instanceof Error ? err.message : 'Erro desconhecido'))
                              }
                              // Resetar input
                              e.target.value = ''
                            }
                          }
                          // Visualizar
                          const handleView = () => {
                            if (file) window.open(file.url, '_blank')
                          }
                          // Deletar
                          const handleDelete = async () => {
                            if (!file || !event.id) return;
                            if (!window.confirm(`Deseja realmente deletar o arquivo '${file.name}'?`)) return;
                            try {
                              // Atualiza o array de arquivos local
                              const updatedFiles = event.files.filter((f) => f.slot !== slotType);
                              const res = await fetch(`/api/events`, {
                                method: 'PUT',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                  id: event.id,
                                  title: event.title,
                                  // description removido pois EventWithFiles não possui essa propriedade
                                  date: event.date,
                                  // type removido pois EventWithFiles não possui essa propriedade
                                  startTime: event.startTime,
                                  endTime: event.endTime,
                                  professionalId: event.professional.id,
                                  files: updatedFiles,
                                }),
                              });
                              if (!res.ok) {
                                const errorData = await res.json();
                                throw new Error(errorData.error || 'Falha ao deletar arquivo');
                              }
                              setEvents((prev) => prev.map(ev =>
                                ev.id === event.id
                                  ? { ...ev, files: updatedFiles }
                                  : ev
                              ));
                            } catch (err) {
                              alert('Erro ao deletar arquivo: ' + (err instanceof Error ? err.message : 'Erro desconhecido'));
                            }
                          }
                          return (
                            <div
                              key={slotType}
                              className={`grow flex items-center justify-between p-3 rounded-lg border ${
                                hasFile ? 'bg-emerald-50 border-emerald-200' : 'bg-gray-50 border-gray-200'
                              }`}
                            >
                              <div className="flex items-center gap-2 overflow-hidden">
                                <span className={`font-medium ${hasFile ? 'text-emerald-800' : 'text-gray-500'}`}>
                                  {labels[slotType]}
                                </span>
                                {hasFile && (
                                  <span className="text-sm text-emerald-700 truncate">
                                    ({file.name})
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2">
                                {hasFile && (
                                  <>
                                    <button
                                      onClick={handleView}
                                      className="text-gray-500 hover:text-blue-600"
                                      title="Visualizar"
                                    >
                                      <Eye size={16} />
                                    </button>
                                    <button
                                      onClick={handleDelete}
                                      className="text-gray-500 hover:text-red-600"
                                      title="Deletar"
                                    >
                                      <Trash2 size={16} />
                                    </button>
                                  </>
                                )}
                                <label title="Upload" className="text-gray-400 hover:text-blue-600 cursor-pointer">
                                  <UploadCloud size={16} />
                                  <input type="file" style={{ display: 'none' }} onChange={handleUpload} accept="*" />
                                </label>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
