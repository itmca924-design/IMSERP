export interface InventoryDashboardStats {
  totalItemsCount: number;
  totalStockValuation: number;
  lowStockCount: number;
  outOfStockCount: number;
  inwardCountThisMonth: number;
  inwardsAmountThisMonth: number;
  outwardCountThisMonth: number;
  outwardSalesThisMonth: number;
  lowStockPreview: InventoryItemSummary[];
}

export interface InventoryItemSummary {
  id: string;
  itemCode: string;
  itemName: string;
  categoryName: string;
  itemType: string;
  unitOfMeasurement: string;
  currentStock: number;
  minStockAlertLevel: number;
  purchasePrice: number;
  sellingPrice: number;
  rackOrLocation?: string;
}

export interface InventoryCategory {
  id: string;
  name: string;
  code: string;
  description?: string;
  isActive: boolean;
  activeItemsCount: number;
  branchId?: string;
}

export interface CreateUpdateCategoryDto {
  name: string;
  code: string;
  description?: string;
  isActive: boolean;
  branchId?: string;
}

export interface InventoryVendor {
  id: string;
  vendorName: string;
  contactPerson?: string;
  phone?: string;
  email?: string;
  address?: string;
  gstin?: string;
  pan?: string;
  paymentTerms?: string;
  bankDetails?: string;
  isActive: boolean;
  branchId?: string;
}

export interface CreateUpdateVendorDto {
  vendorName: string;
  contactPerson?: string;
  phone?: string;
  email?: string;
  address?: string;
  gstin?: string;
  pan?: string;
  paymentTerms?: string;
  bankDetails?: string;
  isActive: boolean;
  branchId?: string;
}

export interface InventoryItem {
  id: string;
  categoryId: string;
  categoryName: string;
  itemCode: string;
  itemName: string;
  itemType: string; // 'Consumable' | 'Kit/Sellable' | 'Asset'
  unitOfMeasurement: string; // 'Pcs' | 'Box' | 'Set' | 'Packet' | 'Dozen' | 'Roll' | 'Kg'
  purchasePrice: number;
  sellingPrice: number;
  currentStock: number;
  minStockAlertLevel: number;
  rackOrLocation?: string;
  description?: string;
  isActive: boolean;
  branchId?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface CreateUpdateItemDto {
  categoryId: string;
  itemCode?: string;
  itemName: string;
  itemType: string;
  unitOfMeasurement: string;
  purchasePrice: number;
  sellingPrice: number;
  initialStock: number;
  minStockAlertLevel: number;
  rackOrLocation?: string;
  description?: string;
  isActive: boolean;
  branchId?: string;
}

export interface InventoryInwardItem {
  id: string;
  itemId: string;
  itemName: string;
  itemCode: string;
  quantity: number;
  unitPrice: number;
  totalAmount: number;
  batchOrSerialNo?: string;
  remarks?: string;
}

export interface InventoryInward {
  id: string;
  inwardNumber: string;
  invoiceBillNumber?: string;
  inwardDate: string;
  vendorId?: string;
  vendorName: string;
  totalAmount: number;
  discountAmount: number;
  taxAmount: number;
  netAmount: number;
  paymentStatus: string;
  paymentMode: string;
  remarks?: string;
  branchId?: string;
  createdAt: string;
  items: InventoryInwardItem[];
}

export interface CreateInwardItemLine {
  itemId: string;
  quantity: number;
  unitPrice: number;
  batchOrSerialNo?: string;
  remarks?: string;
}

export interface CreateInwardDto {
  vendorId?: string;
  invoiceBillNumber?: string;
  inwardDate?: string;
  discountAmount: number;
  taxAmount: number;
  paymentStatus: string;
  paymentMode: string;
  remarks?: string;
  branchId?: string;
  items: CreateInwardItemLine[];
}

export interface InventoryOutwardItem {
  id: string;
  itemId: string;
  itemName: string;
  itemCode: string;
  quantity: number;
  unitPrice: number;
  totalAmount: number;
  remarks?: string;
}

export interface InventoryOutward {
  id: string;
  issueNumber: string;
  issueDate: string;
  issueType: string; // 'StaffDepartmentIssue' | 'StudentKitSale' | 'DisposalDamage'
  studentId?: string;
  studentName?: string;
  studentRollNo?: string;
  issuedToName: string;
  departmentOrClass?: string;
  totalAmount: number;
  paymentStatus: string;
  paymentMode?: string;
  remarks?: string;
  branchId?: string;
  createdAt: string;
  items: InventoryOutwardItem[];
}

export interface CreateOutwardItemLine {
  itemId: string;
  quantity: number;
  unitPrice: number;
  remarks?: string;
}

export interface CreateOutwardDto {
  issueType: string;
  studentId?: string;
  issuedToName: string;
  departmentOrClass?: string;
  issueDate?: string;
  paymentStatus: string;
  paymentMode?: string;
  remarks?: string;
  branchId?: string;
  items: CreateOutwardItemLine[];
}

export interface InventoryStockAdjustment {
  id: string;
  itemId: string;
  itemName: string;
  itemCode: string;
  adjustmentType: string;
  previousStock: number;
  adjustedQuantity: number;
  newStock: number;
  reason?: string;
  adjustedAt: string;
}

export interface CreateStockAdjustmentDto {
  itemId: string;
  adjustmentType: string;
  adjustedQuantity: number;
  reason?: string;
}

export interface StudentLookupItem {
  id: string;
  fullName: string;
  rollNumber: string;
  admissionNumber: string;
  phoneNumber?: string;
  className?: string;
  sectionName?: string;
  classId?: string;
}

export interface StaffLookupItem {
  id: string;
  employeeCode: string;
  fullName: string;
  staffType: 'Teaching' | 'NonTeaching' | string;
  designation?: string;
  department?: string;
  branchId?: string;
}
