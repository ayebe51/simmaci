import { useState, useEffect } from "react"
import { useQuery } from "@tanstack/react-query"
import { Check, ChevronsUpDown } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { schoolApi } from "@/lib/api"

interface School {
  id: number
  nama: string
  kecamatan?: string
}

interface SchoolAutocompleteProps {
  value: string
  onChange: (value: string) => void
  disabled?: boolean
  placeholder?: string
  error?: string
}

export function SchoolAutocomplete({
  value,
  onChange,
  disabled = false,
  placeholder = "Pilih Madrasah",
  error
}: SchoolAutocompleteProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")

  // Debounce search input by 300ms
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search)
    }, 300)

    return () => clearTimeout(timer)
  }, [search])

  // Fetch schools with debounced search query
  const { data: schools = [], isLoading } = useQuery({
    queryKey: ['schools-autocomplete', debouncedSearch],
    queryFn: () => schoolApi.list({ search: debouncedSearch }),
    enabled: debouncedSearch.length >= 2 || open,
    staleTime: 5 * 60 * 1000, // 5 minutes cache
  })

  const selectedSchool = schools.find((s: School) => s.nama === value)

  return (
    <div className="space-y-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            disabled={disabled}
            className={cn(
              "w-full justify-between h-12 rounded-xl bg-slate-50 border-0 font-bold text-slate-700 hover:bg-slate-100",
              error && "border-red-500 border-2",
              disabled && "opacity-80 cursor-not-allowed"
            )}
          >
            <span className={cn(
              "truncate",
              !selectedSchool && "text-slate-400 font-normal"
            )}>
              {selectedSchool ? selectedSchool.nama : placeholder}
            </span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
          <Command shouldFilter={false}>
            <CommandInput
              placeholder="Cari madrasah..."
              value={search}
              onValueChange={setSearch}
              className="h-11"
            />
            <CommandList>
              <CommandEmpty>
                {isLoading 
                  ? "Memuat..." 
                  : search.length < 2 
                    ? "Ketik minimal 2 karakter untuk mencari"
                    : "Madrasah tidak ditemukan"
                }
              </CommandEmpty>
              <CommandGroup className="max-h-64 overflow-auto">
                {schools.map((school: School) => (
                  <CommandItem
                    key={school.id}
                    value={school.nama}
                    onSelect={() => {
                      onChange(school.nama)
                      setOpen(false)
                      setSearch("")
                    }}
                    className="cursor-pointer"
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        value === school.nama ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <div className="flex flex-col">
                      <span className="font-bold text-sm">{school.nama}</span>
                      {school.kecamatan && (
                        <span className="text-xs text-slate-500">
                          Kec. {school.kecamatan}
                        </span>
                      )}
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {error && (
        <p className="text-xs text-red-500 font-medium">{error}</p>
      )}
    </div>
  )
}
