'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Building2,
  Check,
  ChevronsUpDown,
  Search,
  Star,
  MapPin,
  Phone,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface Company {
  id: number;
  name: string;
  shortName: string | null;
  creditCode: string;
  isActive: boolean;
}

interface CompanySelectorProps {
  value?: number | null;
  onChange: (companyId: number | null, companyInfo?: Company) => void;
  placeholder?: string;
  disabled?: boolean;
  showDefault?: boolean;
  filterActive?: boolean;
  className?: string;
}

export function CompanySelector({
  value,
  onChange,
  placeholder = '选择公司...',
  disabled = false,
  showDefault = true,
  filterActive = true,
  className,
}: CompanySelectorProps) {
  const [open, setOpen] = useState(false);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [defaultCompany, setDefaultCompany] = useState<Company | null>(null);

  // 获取公司列表
  const fetchCompanies = useCallback(async (keyword?: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.append('action', 'list');
      if (filterActive) {
        params.append('isActive', 'true');
      }
      if (keyword) {
        params.append('keyword', keyword);
      }

      const res = await fetch(`/api/company-sync?${params.toString()}`);
      const data = await res.json();
      if (data.success) {
        setCompanies(data.data);
      }
    } catch (error) {
      console.error('获取公司列表失败:', error);
    } finally {
      setLoading(false);
    }
  }, [filterActive]);

  // 获取默认公司
  const fetchDefaultCompany = useCallback(async () => {
    try {
      const res = await fetch('/api/company-sync?action=default');
      const data = await res.json();
      if (data.success && data.data) {
        setDefaultCompany(data.data);
      }
    } catch (error) {
      console.error('获取默认公司失败:', error);
    }
  }, []);

  useEffect(() => {
    fetchCompanies();
    if (showDefault) {
      fetchDefaultCompany();
    }
  }, [fetchCompanies, fetchDefaultCompany, showDefault]);

  // 搜索处理
  const handleSearch = useCallback((keyword: string) => {
    setSearchKeyword(keyword);
    if (keyword.length >= 1) {
      fetchCompanies(keyword);
    } else {
      fetchCompanies();
    }
  }, [fetchCompanies]);

  // 获取当前选中的公司
  const selectedCompany = companies.find((c) => c.id === value) || 
    (defaultCompany && defaultCompany.id === value ? defaultCompany : null);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn('w-full justify-between', className)}
        >
          {selectedCompany ? (
            <div className="flex items-center gap-2 truncate">
              <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="truncate">{selectedCompany.name}</span>
              {defaultCompany?.id === selectedCompany.id && (
                <Star className="h-3 w-3 text-yellow-500 fill-yellow-500" />
              )}
            </div>
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[400px] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="搜索公司名称或信用代码..."
            value={searchKeyword}
            onValueChange={handleSearch}
          />
          <CommandList>
            {loading ? (
              <div className="p-4 space-y-2">
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
              </div>
            ) : companies.length === 0 ? (
              <CommandEmpty>未找到公司</CommandEmpty>
            ) : (
              <>
                {showDefault && defaultCompany && (
                  <CommandGroup heading="默认公司">
                    <CommandItem
                      value={`default-${defaultCompany.id}`}
                      onSelect={() => {
                        onChange(defaultCompany.id, defaultCompany);
                        setOpen(false);
                      }}
                    >
                      <div className="flex items-center gap-2 w-full">
                        <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                        <Building2 className="h-4 w-4" />
                        <div className="flex-1">
                          <div className="font-medium">{defaultCompany.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {defaultCompany.creditCode}
                          </div>
                        </div>
                        <Check
                          className={cn(
                            'h-4 w-4',
                            value === defaultCompany.id ? 'opacity-100' : 'opacity-0'
                          )}
                        />
                      </div>
                    </CommandItem>
                  </CommandGroup>
                )}
                <CommandGroup heading="公司列表">
                  {companies
                    .filter((c) => !showDefault || c.id !== defaultCompany?.id)
                    .map((company) => (
                      <CommandItem
                        key={company.id}
                        value={company.id.toString()}
                        onSelect={() => {
                          onChange(company.id, company);
                          setOpen(false);
                        }}
                      >
                        <div className="flex items-center gap-2 w-full">
                          <Building2 className="h-4 w-4" />
                          <div className="flex-1">
                            <div className="font-medium">{company.name}</div>
                            <div className="text-xs text-muted-foreground">
                              {company.creditCode}
                            </div>
                          </div>
                          {!company.isActive && (
                            <Badge variant="secondary" className="text-xs">
                              已停用
                            </Badge>
                          )}
                          <Check
                            className={cn(
                              'h-4 w-4',
                              value === company.id ? 'opacity-100' : 'opacity-0'
                            )}
                          />
                        </div>
                      </CommandItem>
                    ))}
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

/**
 * 公司信息预览卡片
 * 用于在选择公司后显示详细信息
 */
interface CompanyInfoPreviewProps {
  companyId: number | null;
  showContact?: boolean;
  showAddress?: boolean;
  onContactSelect?: (contact: any) => void;
}

export function CompanyInfoPreview({
  companyId,
  showContact = true,
  showAddress = true,
  onContactSelect,
}: CompanyInfoPreviewProps) {
  const [loading, setLoading] = useState(false);
  const [companyInfo, setCompanyInfo] = useState<any>(null);

  useEffect(() => {
    if (!companyId) {
      setCompanyInfo(null);
      return;
    }

    const fetchInfo = async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/company-sync?action=seal-info&companyId=${companyId}`
        );
        const data = await res.json();
        if (data.success) {
          setCompanyInfo(data.data);
        }
      } catch (error) {
        console.error('获取公司信息失败:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchInfo();
  }, [companyId]);

  if (!companyId) return null;

  if (loading) {
    return (
      <div className="p-4 space-y-2 border rounded-lg bg-muted/30">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-24" />
      </div>
    );
  }

  if (!companyInfo) return null;

  return (
    <div className="p-4 space-y-3 border rounded-lg bg-muted/30">
      {showAddress && (
        <div className="flex items-start gap-2">
          <MapPin className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
          <div>
            <span className="text-sm font-medium">地址：</span>
            <span className="text-sm text-muted-foreground">
              {companyInfo.address}
            </span>
          </div>
        </div>
      )}

      {showContact && companyInfo.contacts && companyInfo.contacts.length > 0 && (
        <div className="space-y-2">
          <span className="text-sm font-medium">对接人：</span>
          <div className="flex flex-wrap gap-2">
            {companyInfo.contacts.map((contact: any) => (
              <Button
                key={contact.id}
                variant={contact.isPrimary ? 'default' : 'outline'}
                size="sm"
                onClick={() => onContactSelect?.(contact)}
                className="h-auto py-1"
              >
                <div className="flex items-center gap-1">
                  <Phone className="h-3 w-3" />
                  <span>{contact.name}</span>
                  {contact.phone && (
                    <span className="text-xs opacity-70">
                      {contact.phone}
                    </span>
                  )}
                  {contact.isPrimary && (
                    <Star className="h-3 w-3 text-yellow-500 fill-yellow-500" />
                  )}
                </div>
              </Button>
            ))}
          </div>
        </div>
      )}

      {companyInfo.legalPerson && (
        <div className="text-sm">
          <span className="font-medium">法人：</span>
          <span className="text-muted-foreground">
            {companyInfo.legalPerson.name}
          </span>
        </div>
      )}

      {companyInfo.agent?.name && (
        <div className="text-sm">
          <span className="font-medium">代理人：</span>
          <span className="text-muted-foreground">
            {companyInfo.agent.name}
          </span>
        </div>
      )}
    </div>
  );
}

export default CompanySelector;
