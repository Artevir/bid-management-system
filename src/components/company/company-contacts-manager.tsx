/**
 * 公司对接人管理组件
 * 支持添加、编辑、删除对接人，支持多角色分配
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select as _Select,
  SelectContent as _SelectContent,
  SelectItem as _SelectItem,
  SelectTrigger as _SelectTrigger,
  SelectValue as _SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Plus,
  Pencil,
  Trash2,
  Phone,
  Mail,
  MessageCircle,
  User,
  Building2,
  Star,
  Loader2,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { Label } from '@/components/ui/label';

// 角色类型
interface ContactRole {
  id: number;
  name: string;
  code: string;
  type: string;
  isSystem: boolean;
  description: string | null;
}

// 对接人类型
interface Contact {
  id: number;
  name: string;
  department: string | null;
  position: string | null;
  phone: string | null;
  telephone: string | null;
  wechat: string | null;
  qq: string | null;
  email: string | null;
  roles: string | null; // JSON字符串
  remarks: string | null;
  isPrimary: boolean;
  isActive: boolean;
}

interface CompanyContactsManagerProps {
  companyId: number;
  readOnly?: boolean;
}

// 角色颜色映射
const ROLE_COLORS: Record<string, string> = {
  bid_contact: 'bg-blue-100 text-blue-800',
  document_prep: 'bg-green-100 text-green-800',
  bid_purchase: 'bg-yellow-100 text-yellow-800',
  stamp_person: 'bg-purple-100 text-purple-800',
  bid_agent: 'bg-orange-100 text-orange-800',
  legal_person: 'bg-red-100 text-red-800',
  sales: 'bg-pink-100 text-pink-800',
  finance: 'bg-cyan-100 text-cyan-800',
  other: 'bg-gray-100 text-gray-800',
};

export function CompanyContactsManager({ companyId, readOnly = false }: CompanyContactsManagerProps) {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [roles, setRoles] = useState<ContactRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [saving, setSaving] = useState(false);
  
  // 表单状态
  const [formData, setFormData] = useState({
    name: '',
    department: '',
    position: '',
    phone: '',
    telephone: '',
    wechat: '',
    qq: '',
    email: '',
    selectedRoles: [] as { id: number; name: string }[],
    remarks: '',
    isPrimary: false,
    isActive: true,
  });

  // 加载数据
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/company-contacts?companyId=${companyId}`);
      const result = await response.json();
      
      if (result.success) {
        setContacts(result.data || []);
        setRoles(result.roles || []);
      } else {
        toast.error(result.error || '加载失败');
      }
    } catch (_error) {
      toast.error('加载对接人数据失败');
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // 打开新增对话框
  const handleAdd = () => {
    setEditingContact(null);
    setFormData({
      name: '',
      department: '',
      position: '',
      phone: '',
      telephone: '',
      wechat: '',
      qq: '',
      email: '',
      selectedRoles: [],
      remarks: '',
      isPrimary: false,
      isActive: true,
    });
    setDialogOpen(true);
  };

  // 打开编辑对话框
  const handleEdit = (contact: Contact) => {
    setEditingContact(contact);
    const parsedRoles = contact.roles ? JSON.parse(contact.roles) : [];
    setFormData({
      name: contact.name,
      department: contact.department || '',
      position: contact.position || '',
      phone: contact.phone || '',
      telephone: contact.telephone || '',
      wechat: contact.wechat || '',
      qq: contact.qq || '',
      email: contact.email || '',
      selectedRoles: parsedRoles,
      remarks: contact.remarks || '',
      isPrimary: contact.isPrimary,
      isActive: contact.isActive,
    });
    setDialogOpen(true);
  };

  // 删除对接人
  const handleDelete = async (contactId: number) => {
    if (!confirm('确定要删除此对接人吗？')) return;
    
    try {
      const response = await fetch(`/api/company-contacts?id=${contactId}`, {
        method: 'DELETE',
      });
      
      const result = await response.json();
      
      if (result.success) {
        toast.success('删除成功');
        loadData();
      } else {
        toast.error(result.error || '删除失败');
      }
    } catch (_error) {
      toast.error('删除失败');
    }
  };

  // 切换角色选择
  const toggleRole = (role: ContactRole) => {
    const isSelected = formData.selectedRoles.some(r => r.id === role.id);
    if (isSelected) {
      setFormData({
        ...formData,
        selectedRoles: formData.selectedRoles.filter(r => r.id !== role.id),
      });
    } else {
      setFormData({
        ...formData,
        selectedRoles: [...formData.selectedRoles, { id: role.id, name: role.name }],
      });
    }
  };

  // 保存对接人
  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast.error('请输入姓名');
      return;
    }
    
    setSaving(true);
    
    try {
      const url = '/api/company-contacts';
      const method = editingContact ? 'PUT' : 'POST';
      const body = editingContact
        ? { id: editingContact.id, ...formData }
        : { companyId, ...formData };
      
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      
      const result = await response.json();
      
      if (result.success) {
        toast.success(editingContact ? '更新成功' : '添加成功');
        setDialogOpen(false);
        loadData();
      } else {
        toast.error(result.error || '保存失败');
      }
    } catch (_error) {
      toast.error('保存失败');
    } finally {
      setSaving(false);
    }
  };

  // 解析对接人的角色
  const parseRoles = (rolesJson: string | null): { id: number; name: string }[] => {
    if (!rolesJson) return [];
    try {
      return JSON.parse(rolesJson);
    } catch {
      return [];
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              对接人管理
            </CardTitle>
            <CardDescription>
              管理友司的对接人和联系方式，支持多角色分配
            </CardDescription>
          </div>
          {!readOnly && (
            <Button onClick={handleAdd} size="sm">
              <Plus className="h-4 w-4 mr-1" />
              添加对接人
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {contacts.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            暂无对接人信息，点击"添加对接人"按钮添加
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[60px]">主要</TableHead>
                <TableHead>姓名</TableHead>
                <TableHead>部门/职务</TableHead>
                <TableHead>角色</TableHead>
                <TableHead>联系方式</TableHead>
                <TableHead>备注</TableHead>
                {!readOnly && <TableHead className="w-[100px]">操作</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {contacts.map((contact) => (
                <TableRow key={contact.id} className={!contact.isActive ? 'opacity-50' : ''}>
                  <TableCell>
                    {contact.isPrimary && (
                      <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                    )}
                  </TableCell>
                  <TableCell className="font-medium">
                    {contact.name}
                    {!contact.isActive && (
                      <Badge variant="secondary" className="ml-2">已禁用</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">
                      {contact.department && (
                        <div className="flex items-center gap-1">
                          <Building2 className="h-3 w-3" />
                          {contact.department}
                        </div>
                      )}
                      {contact.position && (
                        <div className="text-muted-foreground">{contact.position}</div>
                      )}
                      {!contact.department && !contact.position && '-'}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {parseRoles(contact.roles).map((role) => (
                        <Badge
                          key={role.id}
                          variant="secondary"
                          className={ROLE_COLORS[roles.find(r => r.id === role.id)?.type || 'other']}
                        >
                          {role.name}
                        </Badge>
                      ))}
                      {parseRoles(contact.roles).length === 0 && '-'}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm space-y-1">
                      {contact.phone && (
                        <div className="flex items-center gap-1">
                          <Phone className="h-3 w-3" />
                          {contact.phone}
                        </div>
                      )}
                      {contact.email && (
                        <div className="flex items-center gap-1">
                          <Mail className="h-3 w-3" />
                          {contact.email}
                        </div>
                      )}
                      {contact.wechat && (
                        <div className="flex items-center gap-1">
                          <MessageCircle className="h-3 w-3" />
                          {contact.wechat}
                        </div>
                      )}
                      {!contact.phone && !contact.email && !contact.wechat && '-'}
                    </div>
                  </TableCell>
                  <TableCell className="max-w-[200px]">
                    <div className="truncate text-sm text-muted-foreground">
                      {contact.remarks || '-'}
                    </div>
                  </TableCell>
                  {!readOnly && (
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(contact)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(contact.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      {/* 新增/编辑对话框 */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingContact ? '编辑对接人' : '添加对接人'}
            </DialogTitle>
            <DialogDescription>
              填写对接人信息和联系方式，可分配多个角色
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {/* 基本信息 */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">姓名 *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="请输入姓名"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="department">部门</Label>
                <Input
                  id="department"
                  value={formData.department}
                  onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                  placeholder="请输入部门"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="position">职务</Label>
                <Input
                  id="position"
                  value={formData.position}
                  onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                  placeholder="请输入职务"
                />
              </div>
              <div className="flex items-end gap-4">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="isPrimary"
                    checked={formData.isPrimary}
                    onCheckedChange={(checked) =>
                      setFormData({ ...formData, isPrimary: checked as boolean })
                    }
                  />
                  <Label htmlFor="isPrimary">主要对接人</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="isActive"
                    checked={formData.isActive}
                    onCheckedChange={(checked) =>
                      setFormData({ ...formData, isActive: checked as boolean })
                    }
                  />
                  <Label htmlFor="isActive">启用</Label>
                </div>
              </div>
            </div>

            {/* 角色选择 */}
            <div className="space-y-2">
              <Label>角色（可多选）</Label>
              <div className="flex flex-wrap gap-2">
                {roles.map((role) => {
                  const isSelected = formData.selectedRoles.some(r => r.id === role.id);
                  return (
                    <Badge
                      key={role.id}
                      variant={isSelected ? 'default' : 'outline'}
                      className={`cursor-pointer ${isSelected ? ROLE_COLORS[role.type] : ''}`}
                      onClick={() => toggleRole(role)}
                    >
                      {isSelected && <X className="h-3 w-3 mr-1" />}
                      {role.name}
                    </Badge>
                  );
                })}
              </div>
            </div>

            {/* 联系方式 */}
            <div className="space-y-2">
              <Label>联系方式</Label>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <Input
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="手机号"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <Input
                    value={formData.telephone}
                    onChange={(e) => setFormData({ ...formData, telephone: e.target.value })}
                    placeholder="座机"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <MessageCircle className="h-4 w-4 text-muted-foreground" />
                  <Input
                    value={formData.wechat}
                    onChange={(e) => setFormData({ ...formData, wechat: e.target.value })}
                    placeholder="微信号"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground text-sm font-medium">QQ</span>
                  <Input
                    value={formData.qq}
                    onChange={(e) => setFormData({ ...formData, qq: e.target.value })}
                    placeholder="QQ号"
                  />
                </div>
                <div className="col-span-2 flex items-center gap-2">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <Input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="邮箱地址"
                  />
                </div>
              </div>
            </div>

            {/* 备注 */}
            <div className="space-y-2">
              <Label htmlFor="remarks">备注</Label>
              <Textarea
                id="remarks"
                value={formData.remarks}
                onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                placeholder="其他备注信息..."
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingContact ? '保存' : '添加'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
