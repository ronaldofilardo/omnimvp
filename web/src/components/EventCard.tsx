"use client";
import { Eye, FileText, Edit, Trash2, UploadCloud, Copy } from 'lucide-react'
import React, { useState } from 'react'
import Image from 'next/image'
import { DeleteEventModal } from './DeleteEventModal'

const OutlineButton = ({
  icon,
  children,
  onClick,
}: {
  icon: React.ReactNode
  children: React.ReactNode
  onClick?: () => void
}) => (
  <button
    className="flex items-center gap-2 h-8 px-3 border border-[#10B981] rounded-md text-[#10B981] font-semibold text-[12px] bg-white hover:bg-[#10B981] hover:text-white transition-colors"
    style={{ minWidth: 0 }}
    onClick={(e) => {
      e.stopPropagation()
      if (onClick) onClick()
    }}
    type="button"
  >
    {icon} {children}
  </button>
)

interface FileSlot {
  type: string
  file: File | null
  status: 'empty' | 'pending' | 'uploaded'
  name: string
  url?: string // URL do arquivo persistido
}

import type { Event } from './Timeline'
interface EventCardProps {
  onUpdate?: () => void
  event: Event
  professional: string
  address: string
  status?: 'past' | 'current' | 'future'
  onEdit?: () => void
  onDelete?: (deleteFiles: boolean) => void
  onView?: () => void
  onFiles?: () => void
}

// ...existing code...

interface FileSlot {
  name: string
  type: string
  file: File | null
  status: 'empty' | 'uploaded' | 'pending'
  category: string
  url?: string // URL do arquivo persistido
}

const fileSlotTypes = [
  { label: 'Solicitação', category: 'request' },
  { label: 'Autorização', category: 'authorization' },
  { label: 'Atestado', category: 'certificate' },
  { label: 'Laudo/Resultado', category: 'result' },
  { label: 'Prescrição', category: 'prescription' },
  { label: 'Nota Fiscal', category: 'invoice' },
]

export function EventCard({
  event,
  professional,
  address,
  status,
  onEdit,
  onDelete,
  onView,
  onFiles,
  onUpdate,
}: EventCardProps) {
  const eventId = event.id
  const initialFiles = Array.isArray(event.files)
    ? event.files
    : typeof event.files === 'string'
      ? JSON.parse(event.files || '[]')
      : [];
  const title =
    event.type === 'CONSULTATION'
      ? 'Consulta'
      : event.type === 'EXAM'
        ? 'Exame'
        : event.type === 'PROCEDURE'
          ? 'Procedimento'
          : event.type === 'MEDICATION'
            ? 'Medicação'
            : event.type
  const time =
    event.startTime && event.endTime
      ? `${event.startTime} - ${event.endTime}`
      : ''
  console.log('[EventCard] Event type:', event.type, 'Title:', title, 'Professional:', professional)
  console.log('[EventCard] Full title string:', `${title} - ${professional} - ${time}`)
  // Regra: se houver observation, mostrar; senão, mostrar description (que será 'Laudo enviado pelo app Omni' para eventos via laudo)
  const instructions = event.observation?.trim()
    ? event.observation
    : event.description || ''
  const [showViewModal, setShowViewModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [showFilesModal, setShowFilesModal] = useState(false)
  const filesMap =
    initialFiles?.reduce(
      (map: Record<string, { slot: string; name: string; url: string }>, file: { slot: string; name: string; url: string }) => {
        map[file.slot] = file
        return map
      },
      {} as Record<string, { slot: string; name: string; url: string }>
    ) || {}
  const [fileSlots, setFileSlots] = useState<FileSlot[]>(
    fileSlotTypes.map((type) => {
      const file = filesMap[type.category]
      return {
        name: file?.name || '',
        type: type.label,
        file: null,
        status: file ? 'uploaded' : 'empty',
        category: type.category,
        url: file?.url || undefined,
      }
    })
  )
  const [previewFile, setPreviewFile] = useState<{
    file: File
    type: string
  } | null>(null)
  return (
    <>
      <div
        className={`w-[360px] h-[220px] bg-white rounded-xl shadow-[0_10px_15px_rgba(0,0,0,0.1)] border border-[#E5E7EB] flex flex-col justify-between ${status === 'past' ? 'opacity-60' : status === 'current' ? 'ring-2 ring-blue-500' : ''}`}
        style={{ padding: '20px' }}
      >
        {/* Título */}
        <div>
          <div className="font-bold text-[16px] text-[#111827] mb-2">
            {title} - {professional} - {time}
          </div>
          <div className="flex flex-col gap-1">
            <div className="flex items-center text-[14px] text-[#6B7280]">
              <span className="mr-1">✋</span>
              {address}
              <button
                className="ml-2 text-[#6B7280] hover:text-[#10B981] transition-colors"
                onClick={(e) => {
                  e.stopPropagation()
                  navigator.clipboard.writeText(address)
                }}
                title="Copiar endereço"
              >
                <Copy className="w-4 h-4" />
              </button>
            </div>
            <div className="text-[14px] font-semibold text-[#111827] cursor-pointer">
              Instruções: {instructions}
            </div>
          </div>
        </div>
        <div className="border-t border-[#E5E7EB] my-3"></div>
        {/* Botões */}
        <div className="flex flex-col gap-2">
          <div className="flex gap-2 mb-2">
            <OutlineButton
              icon={<Eye className="w-4 h-4" />}
              onClick={() => setShowViewModal(true)}
            >
              Detalhes
            </OutlineButton>
            <OutlineButton
              icon={
                <FileText
                  className={`w-4 h-4 ${fileSlots.some((slot) => slot.file || slot.url) ? 'text-[#10B981]' : ''}`}
                />
              }
              onClick={() => setShowFilesModal(true)}
            >
              <span
                className={
                  fileSlots.some((slot) => slot.file || slot.url)
                    ? 'text-[#10B981] font-bold'
                    : ''
                }
              >
                Arquivos
              </span>
            </OutlineButton>
          </div>
          <div className="flex gap-2">
            <OutlineButton icon={<Edit className="w-4 h-4" />} onClick={onEdit}>
              Editar
            </OutlineButton>
            <OutlineButton
              icon={<Trash2 className="w-4 h-4" />}
              onClick={() => setShowDeleteModal(true)}
            >
              Deletar
            </OutlineButton>
          </div>
        </div>
      </div>

      {/* Modal de Visualização */}
      {showViewModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-[400px] shadow-xl">
            <h2 className="text-lg font-bold mb-4 text-[#111827]">{title}</h2>
            <div className="space-y-2 text-[#111827]">
              <p>
                <span className="font-semibold">Profissional:</span>{' '}
                {professional}
              </p>
              <p>
                <span className="font-semibold">Horário:</span> {time}
              </p>
              <p>
                <span className="font-semibold">Endereço:</span> {address}
                <button
                  className="ml-2 text-[#6B7280] hover:text-[#10B981] transition-colors"
                  onClick={() => navigator.clipboard.writeText(address)}
                  title="Copiar endereço"
                >
                  <Copy className="w-4 h-4" />
                </button>
              </p>
              <p>
                <span className="font-semibold">Instruções:</span>{' '}
                {instructions}
              </p>
            </div>
            <div className="mt-6 flex justify-center">
              <button
                className="px-6 py-2 bg-[#00FF00] text-white rounded-md font-semibold hover:bg-[#00DD00] transition-colors"
                onClick={() => setShowViewModal(false)}
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Deleção */}
      <DeleteEventModal
        open={showDeleteModal}
        onOpenChange={setShowDeleteModal}
        onConfirm={(deleteFiles) => {
          onDelete?.(deleteFiles)
          setShowDeleteModal(false)
        }}
        eventTitle={event.title}
      />

      {/* Modal de Arquivos */}
      {showFilesModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-[800px] shadow-xl">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-lg font-bold">
                Gerenciar Arquivos do Evento
              </h2>
              <button
                className="text-gray-500 hover:text-gray-700"
                onClick={() => setShowFilesModal(false)}
              >
                ×
              </button>
            </div>
            <div className="grid grid-cols-2 gap-4 mb-6">
              {fileSlots.map((slot, index) => (
                <div
                  key={slot.type}
                  className={`border rounded-lg p-4 transition-all duration-200 ${slot.file || slot.url ? 'bg-[#F0FFF4] border-[#10B981]' : 'bg-gray-50 border-gray-200'} shadow-sm`}
                >
                  <div className="flex justify-between items-center mb-2">
                    <span
                      className={`font-semibold ${slot.file || slot.url ? 'text-[#10B981]' : 'text-gray-400'}`}
                    >
                      {slot.type}
                    </span>
                    <div className="flex gap-2">
                      {(slot.file || slot.url) && (
                        <>
                          <button
                            title="Visualizar"
                            onClick={() => {
                              if (slot.url) {
                                // Abrir arquivo persistido em nova aba
                                window.open(slot.url, '_blank')
                              } else if (slot.file) {
                                setPreviewFile({
                                  file: slot.file,
                                  type: slot.type,
                                })
                              }
                            }}
                            className="text-blue-600 hover:text-blue-800 bg-white border border-blue-100 rounded p-1 shadow-sm"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            title="Deletar"
                            onClick={() => {
                              const newSlots = [...fileSlots]
                              newSlots[index] = {
                                ...slot,
                                file: null,
                                status: 'empty',
                                name: '',
                                url: undefined,
                              }
                              setFileSlots(newSlots)
                            }}
                            className="text-red-600 hover:text-red-800 bg-white border border-red-100 rounded p-1 shadow-sm"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </>
                      )}
                      <label
                        className={`cursor-pointer ${slot.file || slot.url ? 'text-green-400 hover:text-green-600' : 'text-green-600 hover:text-green-800'} bg-white border border-green-100 rounded p-1 shadow-sm`}
                      >
                        <UploadCloud className="w-4 h-4" />
                        <input
                          type="file"
                          className="hidden"
                          accept="image/*,.pdf"
                          onChange={(e) => {
                            const file = e.target.files?.[0]
                            if (file) {
                              if (file.size > 2 * 1024) {
                                alert('O arquivo deve ter no máximo 2 KB.')
                                return
                              }
                              const newSlots = [...fileSlots]
                              newSlots[index] = {
                                ...slot,
                                file,
                                status: 'pending',
                                name: file.name,
                              }
                              setFileSlots(newSlots)
                            }
                          }}
                        />
                      </label>
                    </div>
                  </div>
                  {(slot.file || slot.url) && (
                    <p className="text-sm text-[#10B981] truncate font-medium flex items-center gap-2">
                      <span className="inline-block w-2 h-2 rounded-full bg-[#10B981]" />
                      {slot.name}
                    </p>
                  )}
                  {!slot.file && !slot.url && (
                    <p className="text-sm text-gray-400 italic">
                      Nenhum arquivo
                    </p>
                  )}
                </div>
              ))}
            </div>
            <div className="flex justify-end">
              <button
                className="px-6 py-2 bg-[#10B981] text-white rounded-md font-semibold hover:bg-[#059669] transition-colors"
                onClick={async () => {
                  if (eventId) {
                    const filesObjects: {
                      slot: string
                      name: string
                      url: string
                    }[] = []
                    // Upload dos arquivos pendentes
                    for (const slot of fileSlots) {
                      if (slot.file && slot.status === 'pending') {
                        const formData = new FormData()
                        formData.append('file', slot.file)
                        try {
                          const uploadResponse = await fetch('/api/upload', {
                            method: 'POST',
                            body: formData,
                          })
                          if (uploadResponse.ok) {
                            const { url } = await uploadResponse.json()
                            filesObjects.push({
                              slot: slot.category, // slot correto
                              name: slot.name,
                              url,
                            })
                            // Atualizar o slot com a URL
                            const newSlots = [...fileSlots]
                            const idx = newSlots.findIndex(
                              (s) => s.category === slot.category
                            )
                            if (idx !== -1) {
                              newSlots[idx] = {
                                ...slot,
                                status: 'uploaded',
                                url,
                              }
                              setFileSlots(newSlots)
                            }
                          } else {
                            console.error(
                              'Erro no upload do arquivo:',
                              slot.name
                            )
                          }
                        } catch (error) {
                          console.error('Erro no upload:', error)
                        }
                      } else if (slot.url) {
                        // Arquivo já persistido
                        filesObjects.push({
                          slot: slot.category, // slot correto
                          name: slot.name,
                          url: slot.url,
                        })
                      }
                    }
                    try {
                      const response = await fetch('/api/events', {
                        method: 'PUT',
                        headers: {
                          'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                          id: event.id,
                          title: event.title,
                          description: event.description,
                          date: new Date(event.date).toISOString().slice(0, 10), // Garantir formato YYYY-MM-DD
                          type: event.type,
                          startTime: event.startTime,
                          endTime: event.endTime,
                          professionalId: event.professionalId,
                          files: filesObjects,
                        }),
                      })
                      if (response.ok) {
                        setShowFilesModal(false)
                        onUpdate?.() // <-- AQUI ESTÁ A MÁGICA
                      } else {
                        console.error('Erro ao salvar arquivos')
                      }
                    } catch (error) {
                      console.error('Erro ao salvar arquivos:', error)
                    }
                  } else {
                    setShowFilesModal(false)
                  }
                }}
              >
                Concluir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Preview de Arquivo */}
      {previewFile && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 shadow-xl max-w-3xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">{previewFile.type}</h3>
              <button
                className="text-gray-500 hover:text-gray-700"
                onClick={() => setPreviewFile(null)}
              >
                ×
              </button>
            </div>
            {previewFile.file.type.startsWith('image/') ? (
              <Image
                src={URL.createObjectURL(previewFile.file)}
                alt={previewFile.file.name}
                className="max-h-[600px] object-contain"
                width={800}
                height={600}
              />
            ) : (
              <div className="text-center py-8">
                <FileText className="w-16 h-16 mx-auto text-gray-400" />
                <p className="mt-2">Arquivo PDF: {previewFile.file.name}</p>
              </div>
            )}
            <div className="mt-4 text-center">
              <button
                className="px-6 py-2 bg-gray-500 text-white rounded-md font-semibold hover:bg-gray-600 transition-colors"
                onClick={() => setPreviewFile(null)}
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
